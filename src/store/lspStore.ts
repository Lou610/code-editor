import { create } from "zustand";

export type LspStateKind = "off" | "unsupported" | "starting" | "ready" | "error";

interface LspStatusState {
  state: LspStateKind;
  server: string;
  message: string;
  recentLogs: string[];
  restartNonce: number;
  menuOpen: boolean;
  setStatus: (next: { state: LspStateKind; server?: string; message?: string }) => void;
  pushLog: (line: string) => void;
  clearLogs: () => void;
  requestRestart: () => void;
  toggleMenu: () => void;
  closeMenu: () => void;
  reset: () => void;
}

export const useLspStore = create<LspStatusState>((set) => ({
  state: "off",
  server: "",
  message: "",
  recentLogs: [],
  restartNonce: 0,
  menuOpen: false,

  setStatus: (next) =>
    set((s) => ({
      state: next.state,
      server: next.server ?? s.server,
      message: next.message ?? "",
    })),

  pushLog: (line) =>
    set((s) => {
      const text = line.trim();
      if (!text) return s;
      const deduped = [text, ...s.recentLogs.filter((x) => x !== text)].slice(0, 20);
      return { recentLogs: deduped };
    }),

  clearLogs: () => set({ recentLogs: [] }),

  requestRestart: () =>
    set((s) => ({
      restartNonce: s.restartNonce + 1,
      state: "starting",
      message: "Restart requested",
    })),

  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  closeMenu: () => set({ menuOpen: false }),

  reset: () =>
    set({
      state: "off",
      server: "",
      message: "",
      recentLogs: [],
      restartNonce: 0,
      menuOpen: false,
    }),
}));
