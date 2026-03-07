import { create } from "zustand";
import type { TabState, LanguageId } from "../types/editor";

// ── localStorage helpers ──────────────────────────────────────────────────────
const RECENT_KEY = "grovenotes:recentFiles";
const WORKSPACE_KEY = "grovenotes:workspaceRoot";

function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return [];
}

function persistRecentFiles(paths: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(paths));
  } catch {}
}

function loadWorkspaceRoot(): string | null {
  try { return localStorage.getItem(WORKSPACE_KEY); } catch { return null; }
}
function persistWorkspaceRoot(path: string | null) {
  try {
    if (path) localStorage.setItem(WORKSPACE_KEY, path);
    else localStorage.removeItem(WORKSPACE_KEY);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

interface EditorState {
  tabs: TabState[];
  activeTabId: string | null;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  terminalOpen: boolean;
  findReplaceOpen: boolean;
  recentFiles: string[];
  workspaceRoot: string | null;
  setWorkspaceRoot: (path: string | null) => void;
  /** Current git branch for the workspace root. Empty string = not a git repo. */
  gitBranch: string;
  setGitBranch: (branch: string) => void;
  /** Increment to request sidebar file list refresh (e.g. after saving a new file in workspace). */
  explorerRefreshTrigger: number;
  requestExplorerRefresh: () => void;
  addTab: (tab: Omit<TabState, "id">) => string;
  /** Add tab or focus existing tab if a tab with the same path is already open. */
  addTabOrFocus: (tab: Omit<TabState, "id">) => string;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string, dirty?: boolean) => void;
  updateTabScroll: (id: string, scrollPosition: number) => void;
  setTabLanguage: (id: string, language: LanguageId) => void;
  reorderTabs: (fromId: string, toId: string) => void;
  setSidebarWidth: (w: number) => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleTerminal: () => void;
  toggleFindReplace: () => void;
  addRecentFile: (path: string) => void;
  setRecentFiles: (paths: string[]) => void;
  /** True when the active tab has a CodeMirror view (for Edit menu enable/disable). */
  editorReady: boolean;
  setEditorReady: (ready: boolean) => void;
  /** Cursor position tracked by EditorPane. */
  cursorLine: number;
  cursorCol: number;
  setCursorPosition: (line: number, col: number) => void;
  /** Modal visibility */
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  gotoLineOpen: boolean;
  projectSearchOpen: boolean;
  toggleSettings: () => void;
  toggleShortcuts: () => void;
  toggleGotoLine: () => void;
  toggleProjectSearch: () => void;
}

function generateId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sidebarWidth: 260,
  sidebarCollapsed: false,
  terminalOpen: false,
  findReplaceOpen: false,
  recentFiles: loadRecentFiles(),
  workspaceRoot: loadWorkspaceRoot(),
  setWorkspaceRoot: (path) => {
    persistWorkspaceRoot(path);
    set({ workspaceRoot: path, gitBranch: "" });
  },
  gitBranch: "",
  setGitBranch: (gitBranch) => set({ gitBranch }),
  explorerRefreshTrigger: 0,
  requestExplorerRefresh: () =>
    set((s) => ({ explorerRefreshTrigger: s.explorerRefreshTrigger + 1 })),

  addTab: (tab) => {
    const id = generateId();
    const newTab: TabState = { ...tab, id };
    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: id,
    }));
    return id;
  },

  addTabOrFocus: (tab) => {
    const path = tab.path;
    if (path != null) {
      const norm = path.replace(/\\/g, "/");
      const existing = get().tabs.find(
        (t: TabState) => t.path != null && t.path.replace(/\\/g, "/") === norm,
      );
      if (existing) {
        set({ activeTabId: existing.id });
        return existing.id;
      }
    }
    return get().addTab(tab);
  },

  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return s;
      const next = s.tabs.filter((t) => t.id !== id);
      const nextActive =
        s.activeTabId === id
          ? next[idx]?.id ?? next[idx - 1]?.id ?? null
          : s.activeTabId;
      return { tabs: next, activeTabId: nextActive };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabContent: (id, content, dirty = true) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, dirty } : t
      ),
    })),

  updateTabScroll: (id, scrollPosition) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, scrollPosition } : t
      ),
    })),

  setTabLanguage: (id, language) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, language } : t)),
    })),

  reorderTabs: (fromId, toId) =>
    set((s) => {
      const tabs = [...s.tabs];
      const fromIdx = tabs.findIndex((t) => t.id === fromId);
      const toIdx = tabs.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s;
      const [moved] = tabs.splice(fromIdx, 1);
      tabs.splice(toIdx, 0, moved);
      return { tabs };
    }),

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  toggleFindReplace: () => set((s) => ({ findReplaceOpen: !s.findReplaceOpen })),

  addRecentFile: (path) =>
    set((s) => {
      const recentFiles = [path, ...s.recentFiles.filter((p) => p !== path).slice(0, 14)];
      persistRecentFiles(recentFiles);
      return { recentFiles };
    }),

  setRecentFiles: (recentFiles) => {
    persistRecentFiles(recentFiles);
    set({ recentFiles });
  },

  editorReady: false,
  setEditorReady: (editorReady) => set({ editorReady }),

  cursorLine: 1,
  cursorCol: 1,
  setCursorPosition: (cursorLine, cursorCol) => set({ cursorLine, cursorCol }),

  settingsOpen: false,
  shortcutsOpen: false,
  gotoLineOpen: false,
  projectSearchOpen: false,
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  toggleGotoLine: () => set((s) => ({ gotoLineOpen: !s.gotoLineOpen })),
  toggleProjectSearch: () => set((s) => ({ projectSearchOpen: !s.projectSearchOpen })),
}));
