import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../store/editorStore";
import { openFileByPath } from "../tauri/files";
import type { TabState } from "../types/editor";

const POLL_INTERVAL = 3000;

export function FileReloadToast() {
  const { tabs } = useEditorStore();
  const [changedPaths, setChangedPaths] = useState<string[]>([]);
  const mtimeCache = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const interval = setInterval(async () => {
      const store = useEditorStore.getState();
      const openTabs = store.tabs.filter((t: TabState) => t.path && !t.dirty);

      for (const tab of openTabs) {
        if (!tab.path) continue;
        const mtime = await invoke<number>("get_file_mtime", { path: tab.path }).catch(() => 0);
        const cached = mtimeCache.current.get(tab.path);
        if (cached === undefined) {
          mtimeCache.current.set(tab.path, mtime);
        } else if (mtime > 0 && mtime !== cached) {
          mtimeCache.current.set(tab.path, mtime);
          setChangedPaths((prev) =>
            prev.includes(tab.path!) ? prev : [...prev, tab.path!],
          );
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Prune stale changed paths when tabs close.
  useEffect(() => {
    const openPaths = new Set(tabs.map((t: TabState) => t.path).filter(Boolean));
    setChangedPaths((prev) => prev.filter((p) => openPaths.has(p)));
  }, [tabs]);

  const reload = async (path: string) => {
    setChangedPaths((prev) => prev.filter((p) => p !== path));
    mtimeCache.current.delete(path);
    const result = await openFileByPath(path);
    if (!result) return;

    const normalized = path.replace(/\\/g, "/");
    const store = useEditorStore.getState();
    const existing = store.tabs.find(
      (t: TabState) => t.path?.replace(/\\/g, "/") === normalized,
    );

    if (existing) {
      // Replace content in the existing tab so reload is immediate and deterministic.
      useEditorStore.setState((s: { tabs: TabState[]; activeTabId: string | null }) => ({
        tabs: s.tabs.map((t: TabState) =>
          t.id === existing.id
            ? {
                ...t,
                path: result.path,
                label: result.label,
                content: result.content,
                language: result.language,
                encoding: result.encoding,
                lineEnding: result.lineEnding,
                dirty: false,
              }
            : t,
        ),
        activeTabId: existing.id,
      }));
      return;
    }

    useEditorStore.getState().addTabOrFocus({ ...result, dirty: false });
  };

  const dismiss = (path: string) => {
    setChangedPaths((prev) => prev.filter((p) => p !== path));
  };

  if (changedPaths.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2">
      {changedPaths.map((path) => {
        const label = path.split(/[/\\]/).pop() ?? path;
        return (
          <div
            key={path}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--border-default)] shadow-xl text-sm"
            style={{ background: "var(--bg-raised)", minWidth: 280 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 5v6m0 2h.01" />
            </svg>
            <span className="flex-1 truncate text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{label}</span>
              {" "}changed on disk
            </span>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: "var(--accent)" }}
              onClick={() => reload(path)}
            >
              Reload
            </button>
            <button
              type="button"
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={() => dismiss(path)}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
