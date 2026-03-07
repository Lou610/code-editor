import { useEffect, useMemo, useRef } from "react";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import type * as Monaco from "monaco-editor";
import { saveFile } from "../tauri/files";
import { setCurrentEditor } from "../editorRef";
import { useEditorStore } from "../store/editorStore";
import { isLightTheme, useSettingsStore } from "../store/settingsStore";
import type { LanguageId } from "../types/editor";
import { LspClient, getLspServerConfig } from "../lsp/client";
import { useLspStore } from "../store/lspStore";

interface DiffHunk {
  start: number;
  lines: number;
  kind: string;
}

interface LspRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

interface LspDiagnostic {
  range: LspRange;
  severity?: number;
  message: string;
  source?: string;
}

interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: LspDiagnostic[];
}

interface LspLocation {
  uri: string;
  range: LspRange;
}

const MONACO_LANGUAGE: Record<LanguageId, string> = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  rust: "rust",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  java: "java",
  go: "go",
  php: "php",
  ruby: "ruby",
  html: "html",
  css: "css",
  json: "json",
  yaml: "yaml",
  toml: "ini",
  markdown: "markdown",
  sql: "sql",
  bash: "shell",
  xml: "xml",
  plain: "plaintext",
};

const COMPLETION_KIND_MAP: Monaco.languages.CompletionItemKind[] = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
];

function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized;
  return normalized.slice(0, idx);
}

function toMonacoRange(monaco: typeof import("monaco-editor"), range: LspRange): Monaco.IRange {
  return new monaco.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1,
  );
}

function toLspPosition(position: Monaco.IPosition): { line: number; character: number } {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

function toMonacoMarkerSeverity(monaco: typeof import("monaco-editor"), severity?: number): Monaco.MarkerSeverity {
  switch (severity) {
    case 1:
      return monaco.MarkerSeverity.Error;
    case 2:
      return monaco.MarkerSeverity.Warning;
    case 3:
      return monaco.MarkerSeverity.Info;
    case 4:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

function flattenHoverContents(contents: unknown): string {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents.map((entry) => flattenHoverContents(entry)).filter(Boolean).join("\n\n");
  }
  if (typeof contents === "object" && contents != null) {
    const value = contents as { value?: unknown; language?: unknown };
    if (typeof value.value === "string" && typeof value.language === "string") {
      return `\`\`\`${value.language}\n${value.value}\n\`\`\``;
    }
    if (typeof value.value === "string") return value.value;
  }
  return "";
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function EditorPane() {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const modelsRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const modelTabMapRef = useRef<WeakMap<Monaco.editor.ITextModel, string>>(new WeakMap());
  const suppressContentEventRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveEnabledRef = useRef(false);
  const autoSaveDelayRef = useRef(1000);
  const diffDecorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const lspClientRef = useRef<LspClient | null>(null);
  const lspProviderDisposablesRef = useRef<Monaco.IDisposable[]>([]);
  const lspActivationTokenRef = useRef(0);

  const {
    tabs,
    activeTabId,
    updateTabContent,
    updateTabScroll,
    setEditorReady,
    setCursorPosition,
    workspaceRoot,
  } = useEditorStore();
  const {
    fontSize,
    tabSize,
    wordWrap,
    fontLigatures,
    autoSave,
    autoSaveDelay,
    fontFamily,
    theme,
    showMinimap,
  } = useSettingsStore();
  const setLspStatus = useLspStore((s) => s.setStatus);
  const pushLspLog = useLspStore((s) => s.pushLog);
  const lspRestartNonce = useLspStore((s) => s.restartNonce);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  useEffect(() => {
    autoSaveEnabledRef.current = autoSave;
    autoSaveDelayRef.current = autoSaveDelay;
  }, [autoSave, autoSaveDelay]);

  const editorOptions = useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(() => {
    const resolvedFont = fontLigatures
      ? `\"${fontFamily}\", \"Consolas\", \"Courier New\", monospace`
      : `\"Consolas\", \"Courier New\", monospace`;
    return {
      automaticLayout: true,
      fontSize,
      tabSize,
      insertSpaces: true,
      wordWrap: wordWrap ? "on" : "off",
      fontFamily: resolvedFont,
      fontLigatures,
      minimap: { enabled: showMinimap },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      renderWhitespace: "selection",
      glyphMargin: true,
    };
  }, [fontSize, tabSize, wordWrap, fontLigatures, fontFamily, showMinimap]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const isLight = isLightTheme(theme);
    monaco.editor.defineTheme("grovenotes-theme", {
      base: isLight ? "vs" : "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": readCssVar("--bg-base", isLight ? "#ffffff" : "#0f1117"),
        "editor.foreground": readCssVar("--text-primary", isLight ? "#1f2328" : "#e6edf3"),
        "editor.lineHighlightBackground": readCssVar("--bg-overlay", isLight ? "#eaeef2" : "#1c2128"),
        "editor.selectionBackground": readCssVar("--accent-muted", isLight ? "rgba(9,105,218,0.12)" : "rgba(56,139,253,0.25)"),
        "editorCursor.foreground": readCssVar("--accent", isLight ? "#0969da" : "#58a6ff"),
        "editorLineNumber.foreground": readCssVar("--text-muted", isLight ? "#6e7781" : "#6e7681"),
        "editorLineNumber.activeForeground": readCssVar("--text-secondary", isLight ? "#57606a" : "#8b949e"),
        "editorGutter.background": readCssVar("--bg-raised", isLight ? "#f6f8fa" : "#161b22"),
      },
    });

    monaco.editor.setTheme("grovenotes-theme");
  }, [theme]);

  const ensureModel = (
    monaco: typeof import("monaco-editor"),
    tab: NonNullable<typeof activeTab>,
  ) => {
    const existing = modelsRef.current.get(tab.id);
    const language = MONACO_LANGUAGE[tab.language] ?? "plaintext";
    if (existing) {
      if (existing.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(existing, language);
      }
      return existing;
    }

    const uri = tab.path
      ? monaco.Uri.file(tab.path)
      : monaco.Uri.parse(`inmemory://tab/${tab.id}`);
    const model = monaco.editor.createModel(tab.content, language, uri);
    modelsRef.current.set(tab.id, model);
    modelTabMapRef.current.set(model, tab.id);
    return model;
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeTab) return;

    const model = ensureModel(monaco, activeTab);
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }

    if (activeTab.scrollPosition != null) {
      editor.setScrollTop(activeTab.scrollPosition);
    }

    const pos = editor.getPosition();
    if (pos) {
      setCursorPosition(pos.lineNumber, pos.column);
    }
  }, [activeTabId, activeTab?.id, activeTab?.language]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeTab) return;

    const model = ensureModel(monaco, activeTab);
    const current = model.getValue();
    if (current !== activeTab.content) {
      suppressContentEventRef.current = true;
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: activeTab.content }],
        () => null,
      );
      suppressContentEventRef.current = false;
    }
  }, [activeTab?.content]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions(editorOptions);
  }, [editorOptions]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeTab) return;

    if (!activeTab.path) {
      diffDecorationsRef.current?.set([]);
      return;
    }

    const model = editor.getModel();
    invoke<DiffHunk[]>("git_file_diff", { path: activeTab.path })
      .then((hunks) => {
        if (editor.getModel() !== model) return;

        const decorations = hunks.map((h) => {
          const start = Math.max(1, h.start);
          const lines = Math.max(1, h.lines);
          const end = start + lines - 1;

          const className =
            h.kind === "added"
              ? "gn-diff-added"
              : h.kind === "deleted"
                ? "gn-diff-deleted"
                : "gn-diff-modified";

          const color =
            h.kind === "added"
              ? "#3fb950"
              : h.kind === "deleted"
                ? "#f85149"
                : "#d29922";

          return {
            range: new monaco.Range(start, 1, end, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: className,
              overviewRuler: {
                color,
                position: monaco.editor.OverviewRulerLane.Left,
              },
            },
          };
        });

        diffDecorationsRef.current?.set(decorations);
      })
      .catch(() => {
        diffDecorationsRef.current?.set([]);
      });
  }, [activeTab?.path, activeTab?.id]);

  useEffect(() => {
    if (!activeTab) {
      setLspStatus({ state: "off", server: "", message: "" });
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const client = lspClientRef.current;
    if (!editor || !monaco || !client || !activeTab) return;

    const token = lspActivationTokenRef.current + 1;
    lspActivationTokenRef.current = token;

    const model = ensureModel(monaco, activeTab);
    const serverConfig = getLspServerConfig(activeTab.language);

    const activate = async () => {
      if (!serverConfig) {
        await client.stopSession();
        setLspStatus({ state: "unsupported", message: "No language server configured" });
        return;
      }

      setLspStatus({ state: "starting", server: serverConfig.server, message: "Starting language server" });

      const cwd = workspaceRoot ?? (activeTab.path ? dirname(activeTab.path) : null);
      const rootUri = workspaceRoot
        ? monaco.Uri.file(workspaceRoot).toString()
        : activeTab.path
          ? monaco.Uri.file(dirname(activeTab.path)).toString()
          : null;

      const ok = await client.startSession(activeTab.language, serverConfig, cwd, rootUri);
      if (!ok || lspActivationTokenRef.current !== token) {
        if (lspActivationTokenRef.current === token) {
          setLspStatus({ state: "error", server: serverConfig.server, message: "Failed to start language server" });
        }
        return;
      }

      setLspStatus({ state: "ready", server: serverConfig.server, message: "Language features active" });

      const uri = model.uri.toString();
      await client.openTextDocument(
        uri,
        serverConfig.lspLanguageId,
        model.getValue(),
        model.getVersionId(),
      );
    };

    void activate();
  }, [activeTab?.id, activeTab?.language, activeTab?.path, workspaceRoot, setLspStatus, lspRestartNonce]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setCurrentEditor(editor);
    setEditorReady(true);

    lspClientRef.current = new LspClient(
      (method, params) => {
        if (method !== "textDocument/publishDiagnostics") return;
        const data = params as PublishDiagnosticsParams;
        if (!data?.uri || !Array.isArray(data.diagnostics)) return;

        const model = monaco.editor.getModel(monaco.Uri.parse(data.uri));
        if (!model) return;

        const markers: Monaco.editor.IMarkerData[] = data.diagnostics.map((d) => ({
          ...toMonacoRange(monaco, d.range),
          message: d.message,
          source: d.source ?? "lsp",
          severity: toMonacoMarkerSeverity(monaco, d.severity),
        }));

        monaco.editor.setModelMarkers(model, "lsp", markers);
      },
      (line) => {
        const text = line.trim();
        if (text) {
          pushLspLog(text);
          console.debug(text);
          if (!text.startsWith("[LSP]")) {
            setLspStatus({ state: "error", message: text });
          }
        }
      },
      () => {
        pushLspLog("[LSP] server exited");
        setLspStatus({ state: "error", message: "Language server exited" });
      },
    );

    const registerLspProviders = (language: string) => {
      const completion = monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: [".", ":", "(", "<", '"', "'", "/"],
        provideCompletionItems: async (model, position) => {
          const client = lspClientRef.current;
          if (!client?.isRunning || client.activeUri !== model.uri.toString()) {
            return { suggestions: [] };
          }

          try {
            const response = await client.request("textDocument/completion", {
              textDocument: { uri: model.uri.toString() },
              position: toLspPosition(position),
              context: { triggerKind: 1 },
            });

            const items = Array.isArray(response)
              ? response
              : ((response as { items?: unknown[] } | null)?.items ?? []);

            const suggestions: Monaco.languages.CompletionItem[] = asArray(items).map((raw) => {
              const item = raw as {
                label: string;
                insertText?: string;
                detail?: string;
                documentation?: unknown;
                kind?: number;
                sortText?: string;
                filterText?: string;
                insertTextFormat?: number;
                textEdit?: { newText: string; range: LspRange };
              };

              const range = item.textEdit
                ? toMonacoRange(monaco, item.textEdit.range)
                : new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column,
                  );

              const kindIndex = item.kind ?? 1;
              const kind = COMPLETION_KIND_MAP[kindIndex] ?? monaco.languages.CompletionItemKind.Text;

              return {
                label: item.label,
                kind,
                detail: item.detail,
                documentation: flattenHoverContents(item.documentation),
                insertText: item.textEdit?.newText ?? item.insertText ?? item.label,
                insertTextRules:
                  item.insertTextFormat === 2
                    ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    : monaco.languages.CompletionItemInsertTextRule.None,
                sortText: item.sortText,
                filterText: item.filterText,
                range,
              };
            });

            return { suggestions };
          } catch {
            return { suggestions: [] };
          }
        },
      });

      const hover = monaco.languages.registerHoverProvider(language, {
        provideHover: async (model, position) => {
          const client = lspClientRef.current;
          if (!client?.isRunning || client.activeUri !== model.uri.toString()) return null;

          try {
            const response = (await client.request("textDocument/hover", {
              textDocument: { uri: model.uri.toString() },
              position: toLspPosition(position),
            })) as { contents?: unknown; range?: LspRange } | null;

            if (!response?.contents) return null;
            const value = flattenHoverContents(response.contents);
            if (!value) return null;

            return {
              range: response.range ? toMonacoRange(monaco, response.range) : undefined,
              contents: [{ value }],
            };
          } catch {
            return null;
          }
        },
      });

      const definition = monaco.languages.registerDefinitionProvider(language, {
        provideDefinition: async (model, position) => {
          const client = lspClientRef.current;
          if (!client?.isRunning || client.activeUri !== model.uri.toString()) return [];

          try {
            const response = await client.request("textDocument/definition", {
              textDocument: { uri: model.uri.toString() },
              position: toLspPosition(position),
            });

            const locations = asArray(response as LspLocation | LspLocation[]);
            return locations
              .filter((loc) => loc?.uri && loc?.range)
              .map((loc) => ({
                uri: monaco.Uri.parse(loc.uri),
                range: toMonacoRange(monaco, loc.range),
              }));
          } catch {
            return [];
          }
        },
      });

      lspProviderDisposablesRef.current.push(completion, hover, definition);
    };

    const registered = new Set<string>();
    for (const language of Object.values(MONACO_LANGUAGE)) {
      if (registered.has(language)) continue;
      registerLspProviders(language);
      registered.add(language);
    }

    const model = editor.getModel();
    if (model) {
      modelTabMapRef.current.set(model, activeTabId ?? "");
    }

    const disposeContent = editor.onDidChangeModelContent(() => {
      if (suppressContentEventRef.current) return;
      const currentModel = editor.getModel();
      if (!currentModel) return;

      const tabId = modelTabMapRef.current.get(currentModel);
      if (!tabId) return;

      const content = currentModel.getValue();
      updateTabContent(tabId, content);

      const client = lspClientRef.current;
      if (client?.isRunning) {
        void client.changeTextDocument(
          currentModel.uri.toString(),
          content,
          currentModel.getVersionId(),
        );
      }

      if (autoSaveEnabledRef.current) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
          void saveFile();
        }, autoSaveDelayRef.current);
      }
    });

    const disposeCursor = editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });

    const disposeScroll = editor.onDidScrollChange(() => {
      const currentModel = editor.getModel();
      if (!currentModel) return;
      const tabId = modelTabMapRef.current.get(currentModel);
      if (!tabId) return;
      updateTabScroll(tabId, editor.getScrollTop());
    });

    diffDecorationsRef.current = editor.createDecorationsCollection();

    const dispose = () => {
      disposeContent.dispose();
      disposeCursor.dispose();
      disposeScroll.dispose();

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      diffDecorationsRef.current?.clear();
      diffDecorationsRef.current = null;

      for (const provider of lspProviderDisposablesRef.current) {
        provider.dispose();
      }
      lspProviderDisposablesRef.current = [];

      void lspClientRef.current?.stopSession();
      lspClientRef.current = null;
      setLspStatus({ state: "off", server: "", message: "" });

      setCurrentEditor(null);
      setEditorReady(false);
      setCursorPosition(1, 1);

      for (const modelToDispose of modelsRef.current.values()) {
        modelToDispose.dispose();
      }
      modelsRef.current.clear();

      editorRef.current = null;
      monacoRef.current = null;
    };

    editor.onDidDispose(dispose);
  };

  if (!activeTab) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-center px-6"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="max-w-sm space-y-3">
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Open a file or create a new one to start editing.
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            Use{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] border border-[var(--border-subtle)] font-mono text-[var(--text-secondary)]">
              File -&gt; Open
            </kbd>{" "}
            or the toolbar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <MonacoEditor
        height="100%"
        defaultLanguage="plaintext"
        defaultValue=""
        options={editorOptions}
        onMount={onMount}
      />
    </div>
  );
}
