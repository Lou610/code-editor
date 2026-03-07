import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { FileContent, LineEnding } from "../types/editor";
import { useEditorStore } from "../store/editorStore";
import { detectLanguage, detectLineEnding, detectEncoding } from "../utils/language";

type OpenResult = {
  path: string;
  label: string;
  content: string;
  language: import("../types/editor").LanguageId;
  encoding: string;
  lineEnding: LineEnding;
};

function buildOpenResult(raw: FileContent): OpenResult {
  const label = raw.path.split(/[/\\]/).pop() ?? "Untitled";
  return {
    path: raw.path,
    label,
    content: raw.content,
    language: detectLanguage(label),
    encoding: detectEncoding(raw.content),
    lineEnding: detectLineEnding(raw.content),
  };
}

export async function openFile(): Promise<OpenResult | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "All", extensions: ["*"] }],
  });
  if (selected == null) return null;
  const path = typeof selected === "string" ? selected : (selected as { path?: string }).path ?? "";
  if (!path) return null;
  try {
    const raw = await invoke<FileContent>("read_file", { path });
    useEditorStore.getState().addRecentFile(raw.path);
    return buildOpenResult(raw);
  } catch (e) {
    console.error("Failed to read file", e);
    return null;
  }
}

/** Open a file by path (e.g. from sidebar explorer or recent files). */
export async function openFileByPath(path: string): Promise<OpenResult | null> {
  try {
    const raw = await invoke<FileContent>("read_file", { path });
    useEditorStore.getState().addRecentFile(raw.path);
    return buildOpenResult(raw);
  } catch (e) {
    console.error("Failed to read file", e);
    return null;
  }
}

export async function saveFile(): Promise<boolean> {
  const { tabs, activeTabId } = useEditorStore.getState();
  const tab = tabs.find((t: import("../types/editor").TabState) => t.id === activeTabId);
  if (!tab?.path) return saveFileAs();
  try {
    await invoke("write_file", { path: tab.path, content: tab.content });
    useEditorStore.getState().updateTabContent(tab.id, tab.content, false);
    return true;
  } catch (e) {
    console.error("Failed to save file", e);
    return false;
  }
}

export async function saveFileAs(): Promise<boolean> {
  const filePath = await save({
    filters: [{ name: "All", extensions: ["*"] }],
  });
  if (!filePath) return false;
  const { tabs, activeTabId } = useEditorStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return false;
  try {
    await invoke("write_file", { path: filePath, content: tab.content });
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id
          ? { ...t, path: filePath, label: filePath.split(/[/\\]/).pop() ?? "Untitled", dirty: false }
          : t,
      ),
    }));
    useEditorStore.getState().addRecentFile(filePath);
    const root = useEditorStore.getState().workspaceRoot;
    if (root) {
      const a = root.replace(/\\/g, "/").replace(/\/?$/, "/");
      const b = filePath.replace(/\\/g, "/");
      if (b.startsWith(a) || a === b) {
        useEditorStore.getState().requestExplorerRefresh();
      }
    }
    return true;
  } catch (e) {
    console.error("Failed to save file", e);
    return false;
  }
}
