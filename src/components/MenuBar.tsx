import { useState, useEffect, useRef } from "react";
import { useEditorStore } from "../store/editorStore";
import { useGroveNotesStore } from "../store/groveNotesStore";
import { pushGroveNote } from "../tauri/groveNotes";
import { openFile, saveFile, saveFileAs, openFileByPath } from "../tauri/files";
import { tryCloseApp } from "../tauri/window";

import { currentEditorView } from "../editorRef";
import { undo, redo, selectAll } from "@codemirror/commands";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";

// ── App icon ─────────────────────────────────────────────────────────────────

function AppIcon() {
  return (
    <img
      src="/assets/images/32x32.png"
      width={18}
      height={18}
      alt="GroveNotes"
      style={{ imageRendering: "crisp-edges", display: "block" }}
    />
  );
}

function IconMinimize() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <path d="M0 5h10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconRestore() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="2.5" y="0.5" width="7" height="7" stroke="currentColor" strokeWidth="1.1" />
      <path d="M0.5 2.5v7h7" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

type MenuId = "file" | "edit" | "view" | "tools" | "help" | null;

const menuBtn =
  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 w-full text-left";
const menuBtnBase = `${menuBtn} text-[var(--text-primary)] hover:bg-[var(--bg-hover)]`;
const menuBtnDisabled = `${menuBtn} text-[var(--text-muted)] cursor-default`;
const separator = "h-px my-1 bg-[var(--border-subtle)]";

function runUndo() {
  const view = currentEditorView;
  if (view) undo({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
}
function runRedo() {
  const view = currentEditorView;
  if (view) redo({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
}
function runSelectAll() {
  const view = currentEditorView;
  if (view) selectAll({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
}
function runCopy() {
  const view = currentEditorView;
  if (view) {
    view.contentDOM.focus();
    document.execCommand("copy");
  }
}
function runCut() {
  const view = currentEditorView;
  if (view) {
    view.contentDOM.focus();
    document.execCommand("cut");
  }
}
function runPaste() {
  const view = currentEditorView;
  if (view) {
    view.contentDOM.focus();
    document.execCommand("paste");
  }
}

export function MenuBar() {
  const {
    addTab,
    addTabOrFocus,
    toggleFindReplace,
    toggleTerminal,
    setSidebarCollapsed,
    sidebarCollapsed,
    recentFiles,
    toggleSettings,
    toggleShortcuts,
    toggleGotoLine,
    toggleProjectSearch,
    toggleWhatsNew,
    closeAllTabs,
    toggleGnBrowser,
    activeTabId,
    tabs,
  } = useEditorStore();

  const { getNoteId } = useGroveNotesStore();
  const activeNoteId = activeTabId ? getNoteId(activeTabId) : null;

  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Track maximized state
  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized);
    let unlisten: (() => void) | undefined;
    win.onResized(() => {
      win.isMaximized().then(setIsMaximized);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const handleMinimize = () => { getCurrentWindow().minimize().catch(console.error); };
  const handleMaximize = () => { getCurrentWindow().toggleMaximize().catch(console.error); };
  const handleClose = () => { tryCloseApp(); };

  // Only start dragging once the mouse actually moves — this prevents
  // startDragging() firing on the 2nd mousedown of a double-click.
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const originX = e.clientX;
    const originY = e.clientY;

    const onMove = (mv: MouseEvent) => {
      if (Math.abs(mv.clientX - originX) > 4 || Math.abs(mv.clientY - originY) > 4) {
        cleanup();
        getCurrentWindow().startDragging().catch(console.error);
      }
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", cleanup);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", cleanup);
  };

  const handleNew = () => {
    setOpenMenu(null);
    addTab({
      path: null,
      label: "Untitled",
      content: "",
      dirty: false,
      language: "plain",
      encoding: "UTF-8",
      lineEnding: "LF",
    });
  };

  const handleOpen = async () => {
    setOpenMenu(null);
    const result = await openFile();
    if (result) addTabOrFocus({ ...result, dirty: false });
  };

  const handleSave = () => {
    setOpenMenu(null);
    saveFile();
  };

  const handleSaveAs = () => {
    setOpenMenu(null);
    saveFileAs();
  };

  const handleOpenFromGn = () => {
    setOpenMenu(null);
    toggleGnBrowser();
  };

  const handleSyncToGn = async () => {
    setOpenMenu(null);
    if (!activeNoteId || !activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    try {
      await pushGroveNote(activeNoteId, tab.content);
      await message("Note synced to GroveNotes successfully.", { title: "GroveNotes", kind: "info" });
    } catch (e) {
      await message(e instanceof Error ? e.message : "Sync failed", { title: "GroveNotes", kind: "error" });
    }
  };

  const handleRecent = async (path: string) => {
    setOpenMenu(null);
    const result = await openFileByPath(path);
    if (result) addTabOrFocus({ ...result, dirty: false });
  };

  const handleExit = () => {
    setOpenMenu(null);
    tryCloseApp();
  };

  const toggle = (menu: MenuId) => {
    setOpenMenu((m) => (m === menu ? null : menu));
  };

  const hasEditor = useEditorStore((s) => s.editorReady);

  return (
    <header
      ref={menuRef}
      className="flex items-center h-11 min-h-11 select-none border-b border-[var(--border-subtle)] relative"
      style={{ background: "var(--bg-raised)" }}
    >
      {/* App icon + name — drag zone */}
      <div
        className="flex items-center gap-2 pl-3 pr-4 h-full select-none cursor-default"
        onMouseDown={handleDragStart}
        onDoubleClick={handleMaximize}
      >
        <AppIcon />
        <span className="text-sm font-semibold tracking-tight pointer-events-none" style={{ color: "var(--text-primary)" }}>
          GroveNotes
        </span>
      </div>

      {/* Menu nav — interactive buttons, NOT a drag region */}
      <nav className="flex items-center gap-0.5">
        {/* File */}
        <div className="relative">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${openMenu === "file" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
            onClick={() => toggle("file")}
          >
            File
          </button>
          {openMenu === "file" && (
            <div
              className="absolute left-0 top-full mt-0.5 py-1 min-w-[200px] rounded-md border border-[var(--border-default)] shadow-lg z-50"
              style={{ background: "var(--bg-overlay)" }}
            >
              <button type="button" className={menuBtnBase} onClick={handleNew}>
                New
              </button>
              <button type="button" className={menuBtnBase} onClick={handleOpen}>
                Open…
              </button>
              <button type="button" className={menuBtnBase} onClick={handleSave}>
                Save
              </button>
              <button type="button" className={menuBtnBase} onClick={handleSaveAs}>
                Save As…
              </button>
              <div className={separator} />
              <button type="button" className={menuBtnBase} onClick={handleOpenFromGn}>
                Open from GroveNotes…
              </button>
              <button
                type="button"
                className={activeNoteId ? menuBtnBase : menuBtnDisabled}
                onClick={activeNoteId ? handleSyncToGn : undefined}
                title={activeNoteId ? "Sync current note back to GroveNotes" : "No GroveNotes note is active"}
              >
                Sync to GroveNotes
              </button>
              <div className={separator} />
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => { setOpenMenu(null); closeAllTabs(); }}
              >
                Close All Tabs
              </button>
              <div className={separator} />
              {recentFiles.length > 0 && (
                <>
                  {recentFiles.slice(0, 10).map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={menuBtnBase}
                      onClick={() => handleRecent(path)}
                      title={path}
                    >
                      <span className="truncate">{path.split(/[/\\]/).pop() ?? path}</span>
                    </button>
                  ))}
                  <div className={separator} />
                </>
              )}
              <button type="button" className={menuBtnBase} onClick={handleExit}>
                Exit
              </button>
            </div>
          )}
        </div>

        {/* Edit */}
        <div className="relative">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${openMenu === "edit" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
            onClick={() => toggle("edit")}
          >
            Edit
          </button>
          {openMenu === "edit" && (
            <div
              className="absolute left-0 top-full mt-0.5 py-1 min-w-[200px] rounded-md border border-[var(--border-default)] shadow-lg z-50"
              style={{ background: "var(--bg-overlay)" }}
            >
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  runUndo();
                }}
              >
                Undo
              </button>
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  runRedo();
                }}
              >
                Redo
              </button>
              <div className={separator} />
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  runCut();
                }}
              >
                Cut
              </button>
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  runCopy();
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  runPaste();
                }}
              >
                Paste
              </button>
              <div className={separator} />
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  toggleFindReplace();
                }}
              >
                Find…
              </button>
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  toggleFindReplace();
                }}
              >
                Replace…
              </button>
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => { setOpenMenu(null); toggleProjectSearch(); }}
              >
                Search in Files…
              </button>
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => { setOpenMenu(null); toggleGotoLine(); }}
              >
                Go to Line…
              </button>
              <div className={separator} />
              <button
                type="button"
                className={hasEditor ? menuBtnBase : menuBtnDisabled}
                onClick={() => {
                  setOpenMenu(null);
                  runSelectAll();
                }}
              >
                Select All
              </button>
            </div>
          )}
        </div>

        {/* View */}
        <div className="relative">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${openMenu === "view" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
            onClick={() => toggle("view")}
          >
            View
          </button>
          {openMenu === "view" && (
            <div
              className="absolute left-0 top-full mt-0.5 py-1 min-w-[200px] rounded-md border border-[var(--border-default)] shadow-lg z-50"
              style={{ background: "var(--bg-overlay)" }}
            >
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => {
                  setOpenMenu(null);
                  setSidebarCollapsed(!sidebarCollapsed);
                }}
              >
                {sidebarCollapsed ? "Show" : "Hide"} Sidebar
              </button>
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => {
                  setOpenMenu(null);
                  toggleTerminal();
                }}
              >
                Toggle Terminal
              </button>
              <div className={separator} />
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => {
                  setOpenMenu(null);
                  toggleFindReplace();
                }}
              >
                Find / Replace
              </button>
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="relative">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${openMenu === "tools" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
            onClick={() => toggle("tools")}
          >
            Tools
          </button>
          {openMenu === "tools" && (
            <div
              className="absolute left-0 top-full mt-0.5 py-1 min-w-[200px] rounded-md border border-[var(--border-default)] shadow-lg z-50"
              style={{ background: "var(--bg-overlay)" }}
            >
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => { setOpenMenu(null); toggleSettings(); }}
              >
                Settings…
              </button>
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => { setOpenMenu(null); toggleShortcuts(); }}
              >
                Keyboard Shortcuts…
              </button>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="relative">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            onClick={() => {
              setOpenMenu(null);
              toggleWhatsNew();
            }}
          >
            What&apos;s New
          </button>
        </div>

        {/* Help */}
        <div className="relative">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${openMenu === "help" ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
            onClick={() => toggle("help")}
          >
            Help
          </button>
          {openMenu === "help" && (
            <div
              className="absolute left-0 top-full mt-0.5 py-1 min-w-[220px] rounded-md border border-[var(--border-default)] shadow-lg z-50"
              style={{ background: "var(--bg-overlay)" }}
            >
              <button
                type="button"
                className={menuBtnBase}
                onClick={async () => {
                  setOpenMenu(null);
                  await message("GroveNotes\n\nA lightweight code editor built with Tauri and React.\n\nVersion 1.0.7", {
                    title: "About",
                    kind: "info",
                  });
                }}
              >
                About
              </button>
              <button
                type="button"
                className={menuBtnBase}
                onClick={() => { setOpenMenu(null); toggleShortcuts(); }}
              >
                Keyboard Shortcuts…
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Flexible drag spacer — fills remaining space, draggable */}
      <div
        className="flex-1 h-full cursor-default"
        onMouseDown={handleDragStart}
        onDoubleClick={handleMaximize}
      />

      {/* Window controls — plain buttons, no drag region */}
      <div className="flex items-stretch h-full">
        <button
          type="button"
          title="Minimize"
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <IconMinimize />
        </button>
        <button
          type="button"
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={handleMaximize}
          className="flex items-center justify-center w-12 h-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          {isMaximized ? <IconRestore /> : <IconMaximize />}
        </button>
        <button
          type="button"
          title="Close"
          onClick={handleClose}
          className="flex items-center justify-center w-12 h-full text-[var(--text-secondary)] transition-colors hover:bg-red-600 hover:text-white"
        >
          <IconClose />
        </button>
      </div>
    </header>
  );
}
