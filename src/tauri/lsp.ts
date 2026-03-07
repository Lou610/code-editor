import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LspDataEvent {
  payload: [number, number[]];
}

export interface LspStderrEvent {
  payload: [number, string];
}

export interface LspExitEvent {
  payload: number;
}

export async function lspStart(
  server: string,
  args: string[] = [],
  cwd?: string,
): Promise<number> {
  return invoke<number>("lsp_start", {
    server,
    args,
    cwd: cwd ?? null,
  });
}

export async function lspSend(pid: number, data: string): Promise<void> {
  await invoke("lsp_send", { pid, data });
}

export async function lspStop(pid: number): Promise<void> {
  await invoke("lsp_stop", { pid });
}

export async function onLspData(
  handler: (pid: number, chunk: Uint8Array) => void,
): Promise<UnlistenFn> {
  return listen<[number, number[]]>("lsp-data", (event) => {
    const [pid, bytes] = event.payload;
    handler(pid, new Uint8Array(bytes));
  });
}

export async function onLspStderr(
  handler: (pid: number, chunk: string) => void,
): Promise<UnlistenFn> {
  return listen<[number, string]>("lsp-stderr", (event) => {
    const [pid, chunk] = event.payload;
    handler(pid, chunk);
  });
}

export async function onLspExit(
  handler: (pid: number) => void,
): Promise<UnlistenFn> {
  return listen<number>("lsp-exit", (event) => {
    handler(event.payload);
  });
}
