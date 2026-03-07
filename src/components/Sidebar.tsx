import { useState, useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "../store/editorStore";
import { openFileByPath } from "../tauri/files";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { DirEntry } from "../types/editor";

interface ContextMenu {
  x: number;
  y: number;
  entry: DirEntry;
}

export function Sidebar() {
  const {
    sidebarWidth,
    sidebarCollapsed,
    setSidebarWidth,
    setSidebarCollapsed,
    workspaceRoot,
    setWorkspaceRoot,
    explorerRefreshTrigger,
    addTabOrFocus,
  } = useEditorStore();

  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, DirEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renaming, setRenaming] = useState<{ entry: DirEntry; value: string } | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; isDir: boolean; value: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) setTimeout(() => renameInputRef.current?.focus(), 0);
  }, [renaming]);

  useEffect(() => {
    if (creating) setTimeout(() => createInputRef.current?.focus(), 0);
  }, [creating]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const loadDir = useCallback(async (path: string) => {
    try {
      const result = await invoke<DirEntry[]>("read_dir", { path });
      return result;
    } catch (e) {
      console.error("read_dir failed", e);
      setError(String(e));
      return [];
    }
  }, []);

  const refreshRoot = useCallback(async () => {
    if (!workspaceRoot) return;
    setError(null);
    const list = await loadDir(workspaceRoot);
    setEntries(list);
  }, [workspaceRoot, loadDir]);

  const refreshParent = useCallback(async (entryPath: string) => {
    const sep = entryPath.includes("\\") ? "\\" : "/";
    const parentPath = entryPath.split(sep).slice(0, -1).join(sep);
    if (!parentPath || parentPath === workspaceRoot) {
      await refreshRoot();
      return;
    }
    const list = await loadDir(parentPath);
    setChildrenCache((c) => ({ ...c, [parentPath]: list }));
  }, [loadDir, refreshRoot, workspaceRoot]);

  useEffect(() => {
    if (workspaceRoot && explorerRefreshTrigger > 0) {
      refreshRoot();
      setChildrenCache({});
    }
  }, [workspaceRoot, explorerRefreshTrigger, refreshRoot]);

  const handleOpenFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected == null) return;
    const path = typeof selected === "string" ? selected : (selected as { path?: string }).path ?? "";
    if (!path) return;
    setWorkspaceRoot(path);
    setError(null);
    setLoading(true);
    const list = await loadDir(path);
    setEntries(list);
    setLoading(false);
    setExpanded(new Set());
    setChildrenCache({});
  };

  const toggleFolder = async (path: string) => {
    if (childrenCache[path]) {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      return;
    }
    setLoading(true);
    const list = await loadDir(path);
    setLoading(false);
    setChildrenCache((c) => ({ ...c, [path]: list }));
    setExpanded((prev) => new Set(prev).add(path));
  };

  const handleFileClick = async (path: string) => {
    const result = await openFileByPath(path);
    if (result) addTabOrFocus({ ...result, dirty: false });
  };

  const handleContextMenu = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const ctxNewFile = () => {
    if (!contextMenu) return;
    const dir = contextMenu.entry.is_dir ? contextMenu.entry.path : getParentPath(contextMenu.entry.path);
    setContextMenu(null);
    setCreating({ parentPath: dir, isDir: false, value: "" });
  };

  const ctxNewFolder = () => {
    if (!contextMenu) return;
    const dir = contextMenu.entry.is_dir ? contextMenu.entry.path : getParentPath(contextMenu.entry.path);
    setContextMenu(null);
    setCreating({ parentPath: dir, isDir: true, value: "" });
  };

  const ctxRename = () => {
    if (!contextMenu) return;
    setRenaming({ entry: contextMenu.entry, value: contextMenu.entry.name });
    setContextMenu(null);
  };

  const ctxDelete = async () => {
    if (!contextMenu) return;
    const entry = contextMenu.entry;
    setContextMenu(null);
    try {
      await invoke("delete_entry", { path: entry.path });
      await refreshParent(entry.path);
    } catch (e) {
      setError(String(e));
    }
  };

  const getParentPath = (p: string) => {
    const sep = p.includes("\\") ? "\\" : "/";
    return p.split(sep).slice(0, -1).join(sep);
  };

  const confirmRename = async () => {
    if (!renaming || !renaming.value.trim()) { setRenaming(null); return; }
    const sep = renaming.entry.path.includes("\\") ? "\\" : "/";
    const parentPath = renaming.entry.path.split(sep).slice(0, -1).join(sep);
    const newPath = parentPath + sep + renaming.value.trim();
    try {
      await invoke("rename_entry", { oldPath: renaming.entry.path, newPath });
      setRenaming(null);
      await refreshParent(renaming.entry.path);
    } catch (e) {
      setError(String(e));
    }
  };

  const confirmCreate = async () => {
    if (!creating || !creating.value.trim()) { setCreating(null); return; }
    const sep = creating.parentPath.includes("\\") ? "\\" : "/";
    const newPath = creating.parentPath + sep + creating.value.trim();
    try {
      if (creating.isDir) {
        await invoke("create_dir", { path: newPath });
      } else {
        await invoke("create_file", { path: newPath });
      }
      setCreating(null);
      const list = await loadDir(creating.parentPath);
      if (creating.parentPath === workspaceRoot) {
        setEntries(list);
      } else {
        setChildrenCache((c) => ({ ...c, [creating.parentPath]: list }));
        setExpanded((prev) => new Set(prev).add(creating.parentPath));
      }
      if (!creating.isDir) {
        const result = await openFileByPath(newPath);
        if (result) addTabOrFocus({ ...result, dirty: false });
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (e2: MouseEvent) => {
      const next = Math.max(160, Math.min(420, startW + (e2.clientX - startX)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const renderEntry = (entry: DirEntry, depth: number = 0) => {
    const isExp = expanded.has(entry.path);
    const childList = entry.is_dir ? childrenCache[entry.path] : null;

    if (renaming?.entry.path === entry.path) {
      return (
        <div key={entry.path} className="flex items-center gap-1 py-0.5 pr-2" style={{ paddingLeft: 12 + depth * 12 }}>
          <span className="flex-shrink-0 w-4" />
          <input
            ref={renameInputRef}
            value={renaming.value}
            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") setRenaming(null);
            }}
            onBlur={confirmRename}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-sm rounded bg-[var(--bg-overlay)] border border-[var(--accent)] text-[var(--text-primary)] focus:outline-none"
          />
        </div>
      );
    }

    if (entry.is_dir) {
      return (
        <div key={entry.path} className="select-none">
          <button
            type="button"
            className="w-full flex items-center gap-1.5 py-1 pr-2 rounded-md hover:bg-[var(--bg-hover)] text-left text-sm text-[var(--text-primary)]"
            style={{ paddingLeft: 12 + depth * 12 }}
            onClick={() => toggleFolder(entry.path)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            <span className="flex-shrink-0 w-4 text-[var(--text-muted)]">
              {isExp ? "▼" : "▶"}
            </span>
            <span className="truncate">{entry.name}</span>
          </button>
          {isExp && (
            <div className="border-l border-[var(--border-subtle)] ml-3" style={{ marginLeft: 12 + depth * 12 }}>
              {childList ? childList.map((e) => renderEntry(e, depth + 1)) : null}
              {/* Inline create input inside expanded folder */}
              {creating && creating.parentPath === entry.path && (
                <div className="flex items-center gap-1 py-0.5 pr-2" style={{ paddingLeft: 12 }}>
                  <span className="flex-shrink-0 w-4 text-[var(--text-muted)]">{creating.isDir ? "📁" : "📄"}</span>
                  <input
                    ref={createInputRef}
                    value={creating.value}
                    onChange={(e) => setCreating({ ...creating, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmCreate();
                      if (e.key === "Escape") setCreating(null);
                    }}
                    onBlur={confirmCreate}
                    placeholder={creating.isDir ? "folder name…" : "file name…"}
                    className="flex-1 min-w-0 px-1.5 py-0.5 text-sm rounded bg-[var(--bg-overlay)] border border-[var(--accent)] text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-muted)]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={entry.path}
        type="button"
        className="w-full flex items-center gap-1.5 py-1 pr-2 rounded-md hover:bg-[var(--bg-hover)] text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        style={{ paddingLeft: 12 + depth * 12 }}
        onClick={() => handleFileClick(entry.path)}
        onContextMenu={(e) => handleContextMenu(e, entry)}
      >
        <span className="flex-shrink-0 w-4" />
        <span className="truncate">{entry.name}</span>
      </button>
    );
  };

  if (sidebarCollapsed) {
    return (
      <aside
        className="flex flex-col w-12 flex-shrink-0 border-r border-[var(--border-subtle)] items-center py-3 gap-2"
        style={{ background: "var(--bg-raised)" }}
      >
        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest rotate-180 whitespace-nowrap mt-4" style={{ writingMode: "vertical-rl" }}>
          Explorer
        </span>
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 12L10 8L6 4" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 relative border-r border-[var(--border-subtle)]"
      style={{ width: sidebarWidth, background: "var(--bg-raised)" }}
    >
      <div className="flex items-center justify-between h-10 px-3 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          {workspaceRoot && (
            <>
              <button
                type="button"
                title="New File"
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => setCreating({ parentPath: workspaceRoot, isDir: false, value: "" })}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z" />
                  <polyline points="9 2 9 6 13 6" />
                  <line x1="8" y1="9" x2="8" y2="13" />
                  <line x1="6" y1="11" x2="10" y2="11" />
                </svg>
              </button>
              <button
                type="button"
                title="New Folder"
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => setCreating({ parentPath: workspaceRoot, isDir: true, value: "" })}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 4h4l2 2h6v6H2V4z" />
                  <line x1="8" y1="7" x2="8" y2="11" />
                  <line x1="6" y1="9" x2="10" y2="9" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 6L6 8L10 10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-2 min-h-0">
        <button
          type="button"
          className="mx-2 mb-2 w-[calc(100%-16px)] flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] border border-[var(--border-default)] hover:border-[var(--accent)] transition-colors"
          onClick={handleOpenFolder}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4h4l2 2h6v6H2V4z" />
          </svg>
          Open Folder
        </button>
        {error && (
          <p className="px-3 py-1 text-xs text-red-400">{error}</p>
        )}
        {workspaceRoot && (
          <div className="px-1">
            <p className="px-2 py-1 text-xs text-[var(--text-muted)] truncate" title={workspaceRoot}>
              {workspaceRoot.split(/[/\\]/).pop() ?? workspaceRoot}
            </p>
            {loading && entries.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Loading…</p>
            ) : (
              <>
                {entries.map((e) => renderEntry(e, 0))}
                {/* Inline create at root */}
                {creating && creating.parentPath === workspaceRoot && (
                  <div className="flex items-center gap-1 py-0.5 pr-2 pl-3">
                    <span className="flex-shrink-0 w-4 text-[var(--text-muted)] text-xs">{creating.isDir ? "▶" : ""}</span>
                    <input
                      ref={createInputRef}
                      value={creating.value}
                      onChange={(e) => setCreating({ ...creating, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmCreate();
                        if (e.key === "Escape") setCreating(null);
                      }}
                      onBlur={confirmCreate}
                      placeholder={creating.isDir ? "folder name…" : "file name…"}
                      className="flex-1 min-w-0 px-1.5 py-0.5 text-sm rounded bg-[var(--bg-overlay)] border border-[var(--accent)] text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-muted)]"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {!workspaceRoot && !error && (
          <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
            Open a folder to browse files.
          </p>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:w-1.5 transition-all group"
        onMouseDown={handleDrag}
        role="separator"
        aria-label="Resize sidebar"
      >
        <span className="absolute inset-y-0 right-0 w-0.5 bg-transparent group-hover:bg-[var(--accent)] opacity-50 group-hover:opacity-100 transition-opacity rounded-full" />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setContextMenu(null)} />
          <div
            className="fixed z-50 py-1 min-w-[160px] rounded-lg border border-[var(--border-default)] shadow-xl"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: "var(--bg-overlay)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={ctxNewFile}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z" />
                <polyline points="9 2 9 6 13 6" />
                <line x1="8" y1="9" x2="8" y2="13" />
                <line x1="6" y1="11" x2="10" y2="11" />
              </svg>
              New File
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={ctxNewFolder}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 4h4l2 2h6v6H2V4z" />
                <line x1="8" y1="7" x2="8" y2="11" />
                <line x1="6" y1="9" x2="10" y2="9" />
              </svg>
              New Folder
            </button>
            <div className="h-px my-1 bg-[var(--border-subtle)]" />
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={ctxRename}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 2l3 3-9 9H2v-3l9-9z" />
              </svg>
              Rename
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-red-400 hover:bg-[var(--bg-hover)] transition-colors"
              onClick={ctxDelete}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 4 4 4 13 4" />
                <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M12 4v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
