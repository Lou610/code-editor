import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { tryCloseApp } from "./tauri/window";
import {
  MenuBar,
  Sidebar,
  TabBar,
  EditorPane,
  StatusBar,
  FindReplace,
  TerminalPanel,
  SettingsModal,
  KeyboardShortcuts,
  GotoLine,
  ProjectSearch,
  Breadcrumb,
  FileReloadToast,
  WhatsNewModal,
  GroveNotesBrowser,
} from "./components";
import { tryCloseTab } from "./components/TabBar";
import { useEditorStore, loadPersistedTabs, loadPersistedActiveTabPath } from "./store/editorStore";
import { useSettingsStore } from "./store/settingsStore";
import { saveFile, openFileByPath } from "./tauri/files";
import { checkForUpdates } from "./tauri/updater";
import "./App.css";

function useTheme() {
  const theme = useSettingsStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
}

function useGitBranch() {
  useEffect(() => {
    const refresh = async () => {
      const root = useEditorStore.getState().workspaceRoot;
      if (!root) { useEditorStore.getState().setGitBranch(""); return; }
      const branch = await invoke<string>("git_branch", { root }).catch(() => "");
      useEditorStore.getState().setGitBranch(branch);
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    // Also refresh when workspace root changes.
    const unsub = useEditorStore.subscribe((state, prev) => {
      if (state.workspaceRoot !== prev.workspaceRoot) refresh();
    });
    return () => { clearInterval(interval); unsub(); };
  }, []);
}

function useAutoUpdateCheck() {
  useEffect(() => {
    // Silent startup check; interactive checks can be wired to a menu action later.
    checkForUpdates({ interactive: false }).catch(() => {});
  }, []);
}

/** Restore tabs from localStorage on startup by re-reading each file from disk. */
function useRestoreTabs() {
  useEffect(() => {
    const saved = loadPersistedTabs();
    if (saved.length === 0) return;
    const activePath = loadPersistedActiveTabPath();

    let firstActiveId: string | null = null;

    (async () => {
      for (const saved_tab of saved) {
        const result = await openFileByPath(saved_tab.path).catch(() => null);
        if (!result) continue;
        const id = useEditorStore.getState().addTabOrFocus({
          path: result.path,
          label: result.label,
          content: result.content,
          dirty: false,
          language: saved_tab.language,
          encoding: saved_tab.encoding,
          lineEnding: saved_tab.lineEnding,
        });
        if (saved_tab.path === activePath && firstActiveId === null) {
          firstActiveId = id;
        }
      }
      // Activate the tab that was active when the app was closed
      if (firstActiveId) {
        useEditorStore.getState().setActiveTab(firstActiveId);
      }
    })();
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}


function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === "n") {
        e.preventDefault();
        useEditorStore.getState().addTab({
          path: null,
          label: "Untitled",
          content: "",
          dirty: false,
          language: "plain",
          encoding: "UTF-8",
          lineEnding: "LF",
        });
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "w") {
        e.preventDefault();
        const { tabs, activeTabId, closeTab } = useEditorStore.getState();
        const tab = tabs.find((t) => t.id === activeTabId);
        if (!tab) return;
        tryCloseTab(tab, closeTab);
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        const { tabs, activeTabId, setActiveTab } = useEditorStore.getState();
        if (tabs.length === 0) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = tabs[(idx + 1) % tabs.length];
        if (next) setActiveTab(next.id);
      }
      if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        const { tabs, activeTabId, setActiveTab } = useEditorStore.getState();
        if (tabs.length === 0) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        if (prev) setActiveTab(prev.id);
      }
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        useEditorStore.getState().toggleTerminal();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "b") {
        e.preventDefault();
        const { sidebarCollapsed, setSidebarCollapsed } = useEditorStore.getState();
        setSidebarCollapsed(!sidebarCollapsed);
      }
      if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        useEditorStore.getState().toggleFindReplace();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "f") {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.projectSearchOpen) state.toggleProjectSearch();
        if (!state.findReplaceOpen) state.toggleFindReplace();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        const state = useEditorStore.getState();
        if (state.findReplaceOpen) state.toggleFindReplace();
        if (!state.projectSearchOpen) state.toggleProjectSearch();
      }
      if (e.ctrlKey && e.key === "g") {
        e.preventDefault();
        useEditorStore.getState().toggleGotoLine();
      }
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        useEditorStore.getState().toggleSettings();
      }
      if (e.ctrlKey && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().toggleShortcuts();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * Catches Alt+F4 / taskbar "Close window" so unsaved files are still
 * protected even when the user bypasses our custom ✕ button.
 * The custom ✕ button and File → Exit call tryCloseApp() directly and
 * never reach this handler.
 */
function useCloseGuard() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested((event) => {
        // Prevent the OS close immediately; tryCloseApp handles the rest.
        event.preventDefault();
        tryCloseApp();
      })
      .then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);
}

export default function App() {
  useTheme();
  useGitBranch();
  useAutoUpdateCheck();
  useRestoreTabs();
  useKeyboardShortcuts();
  useCloseGuard();

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-base)" }}>
      <MenuBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TabBar />
          <FindReplace />
          <div className="flex-1 flex flex-col min-h-0">
            <Breadcrumb />
            <EditorPane />
          </div>
          <TerminalPanel />
        </div>
      </div>
      <StatusBar />
      <SettingsModal />
      <KeyboardShortcuts />
      <GotoLine />
      <ProjectSearch />
      <WhatsNewModal />
      <FileReloadToast />
      <GroveNotesBrowser />
    </div>
  );
}
