import type { UnlistenFn } from "@tauri-apps/api/event";
import type { LanguageId } from "../types/editor";
import {
  lspSend,
  lspStart,
  lspStop,
  onLspData,
  onLspExit,
  onLspStderr,
} from "../tauri/lsp";

export interface LspServerConfig {
  server: string;
  args: string[];
  lspLanguageId: string;
}

export type JsonRpcNotificationHandler = (method: string, params: unknown) => void;
export type LspStderrHandler = (line: string) => void;
export type LspExitHandler = () => void;

const LSP_SERVER_MAP: Partial<Record<LanguageId, LspServerConfig>> = {
  rust: { server: "rust-analyzer", args: [], lspLanguageId: "rust" },
  python: { server: "pyright-langserver", args: ["--stdio"], lspLanguageId: "python" },
  go: { server: "gopls", args: [], lspLanguageId: "go" },
  c: { server: "clangd", args: [], lspLanguageId: "c" },
  cpp: { server: "clangd", args: [], lspLanguageId: "cpp" },
  csharp: { server: "omnisharp", args: ["--languageserver"], lspLanguageId: "csharp" },
  java: { server: "jdtls", args: [], lspLanguageId: "java" },
  json: { server: "vscode-json-language-server", args: ["--stdio"], lspLanguageId: "json" },
  yaml: { server: "yaml-language-server", args: ["--stdio"], lspLanguageId: "yaml" },
  bash: { server: "bash-language-server", args: ["start"], lspLanguageId: "shellscript" },
  sql: { server: "sql-language-server", args: ["up", "--method", "stdio"], lspLanguageId: "sql" },
  php: { server: "intelephense", args: ["--stdio"], lspLanguageId: "php" },
};

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

class JsonRpcStreamParser {
  private buffer = new Uint8Array(0);
  private readonly decoder = new TextDecoder();

  push(chunk: Uint8Array): unknown[] {
    if (chunk.length === 0) return [];

    const next = new Uint8Array(this.buffer.length + chunk.length);
    next.set(this.buffer, 0);
    next.set(chunk, this.buffer.length);
    this.buffer = next;

    const messages: unknown[] = [];

    while (true) {
      const headerEnd = this.findHeaderEnd(this.buffer);
      if (headerEnd < 0) break;

      const headerText = this.decoder.decode(this.buffer.slice(0, headerEnd));
      const contentLength = this.readContentLength(headerText);
      if (contentLength == null) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (this.buffer.length < bodyEnd) break;

      const bodyText = this.decoder.decode(this.buffer.slice(bodyStart, bodyEnd));
      this.buffer = this.buffer.slice(bodyEnd);

      try {
        messages.push(JSON.parse(bodyText));
      } catch {
        // Ignore malformed payloads and keep parsing future frames.
      }
    }

    return messages;
  }

  private findHeaderEnd(data: Uint8Array): number {
    for (let i = 0; i <= data.length - 4; i += 1) {
      if (
        data[i] === 13 &&
        data[i + 1] === 10 &&
        data[i + 2] === 13 &&
        data[i + 3] === 10
      ) {
        return i;
      }
    }
    return -1;
  }

  private readContentLength(headerText: string): number | null {
    const lines = headerText.split("\r\n");
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      if (key !== "content-length") continue;
      const value = Number(line.slice(idx + 1).trim());
      if (!Number.isFinite(value) || value < 0) return null;
      return value;
    }
    return null;
  }
}

function encodeFrame(payload: unknown): string {
  const body = JSON.stringify(payload);
  const length = new TextEncoder().encode(body).byteLength;
  return `Content-Length: ${length}\r\n\r\n${body}`;
}

export function getLspServerConfig(language: LanguageId): LspServerConfig | null {
  return LSP_SERVER_MAP[language] ?? null;
}

export class LspClient {
  private pid: number | null = null;
  private parser = new JsonRpcStreamParser();
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private unlisten: UnlistenFn[] = [];

  public capabilities: Record<string, unknown> | null = null;
  public activeUri: string | null = null;
  public activeLanguage: LanguageId | null = null;
  public activeServer: string | null = null;

  constructor(
    private readonly onNotification: JsonRpcNotificationHandler,
    private readonly onStderr: LspStderrHandler,
    private readonly onExit: LspExitHandler,
  ) {}

  get isRunning(): boolean {
    return this.pid != null;
  }

  async startSession(
    language: LanguageId,
    config: LspServerConfig,
    cwd: string | null,
    rootUri: string | null,
  ): Promise<boolean> {
    await this.stopSession();

    try {
      this.pid = await lspStart(config.server, config.args, cwd ?? undefined);
      this.activeLanguage = language;
      this.activeServer = config.server;
      await this.attachListeners();

      const initializeResult = await this.request("initialize", {
        processId: null,
        clientInfo: { name: "GroveNotes", version: "1.0.1" },
        rootUri,
        capabilities: {
          textDocument: {
            hover: { dynamicRegistration: false },
            completion: {
              dynamicRegistration: false,
              completionItem: {
                snippetSupport: true,
                documentationFormat: ["markdown", "plaintext"],
              },
            },
            definition: { dynamicRegistration: false },
            publishDiagnostics: { relatedInformation: true },
          },
        },
      });

      this.capabilities =
        typeof initializeResult === "object" && initializeResult != null
          ? (initializeResult as { capabilities?: Record<string, unknown> }).capabilities ?? null
          : null;

      this.notify("initialized", {});
      return true;
    } catch (err) {
      this.onStderr(`[LSP] failed to start ${config.server}: ${String(err)}`);
      await this.stopSession();
      return false;
    }
  }

  async openTextDocument(uri: string, languageId: string, text: string, version: number): Promise<void> {
    this.activeUri = uri;
    this.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId,
        version,
        text,
      },
    });
  }

  async changeTextDocument(uri: string, text: string, version: number): Promise<void> {
    if (!this.isRunning) return;
    if (this.activeUri !== uri) return;

    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  async closeTextDocument(uri: string): Promise<void> {
    if (!this.isRunning) return;
    this.notify("textDocument/didClose", { textDocument: { uri } });
    if (this.activeUri === uri) {
      this.activeUri = null;
    }
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    if (this.pid == null) {
      throw new Error("LSP session is not running");
    }

    const id = this.nextId;
    this.nextId += 1;

    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const frame = encodeFrame(payload);
    await lspSend(this.pid, frame);

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP request timed out: ${method}`));
      }, 12000);

      this.pending.set(id, { resolve, reject, timer });
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.pid == null) return;

    const payload: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const frame = encodeFrame(payload);
    void lspSend(this.pid, frame);
  }

  async stopSession(): Promise<void> {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`LSP request canceled: ${id}`));
    }
    this.pending.clear();

    if (this.pid != null) {
      const oldPid = this.pid;
      this.pid = null;

      try {
        await lspStop(oldPid);
      } catch {
        // no-op
      }
    }

    for (const un of this.unlisten) {
      un();
    }
    this.unlisten = [];

    this.parser = new JsonRpcStreamParser();
    this.capabilities = null;
    this.activeUri = null;
    this.activeLanguage = null;
    this.activeServer = null;
  }

  private async attachListeners(): Promise<void> {
    const dataUnlisten = await onLspData((pid, chunk) => {
      if (this.pid == null || pid !== this.pid) return;

      const messages = this.parser.push(chunk);
      for (const message of messages) {
        this.handleMessage(message);
      }
    });

    const stderrUnlisten = await onLspStderr((pid, text) => {
      if (this.pid == null || pid !== this.pid) return;
      this.onStderr(text);
    });

    const exitUnlisten = await onLspExit((pid) => {
      if (this.pid == null || pid !== this.pid) return;
      this.pid = null;
      this.onExit();
    });

    this.unlisten.push(dataUnlisten, stderrUnlisten, exitUnlisten);
  }

  private handleMessage(message: unknown): void {
    if (typeof message !== "object" || message == null) return;

    const maybe = message as Partial<JsonRpcSuccess & JsonRpcFailure & JsonRpcNotification>;

    if (typeof maybe.id === "number" && ("result" in maybe || "error" in maybe)) {
      const pending = this.pending.get(maybe.id);
      if (!pending) return;
      this.pending.delete(maybe.id);
      clearTimeout(pending.timer);

      if ("error" in maybe && maybe.error) {
        pending.reject(new Error(maybe.error.message));
      } else {
        pending.resolve(maybe.result);
      }
      return;
    }

    if (typeof maybe.method === "string") {
      this.onNotification(maybe.method, maybe.params);
    }
  }
}
