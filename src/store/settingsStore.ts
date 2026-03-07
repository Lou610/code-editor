import { create } from "zustand";

export type AppTheme = "dark" | "light";
export type EditorFontFamily =
  | "JetBrains Mono"
  | "Fira Code"
  | "Cascadia Code"
  | "Source Code Pro"
  | "Consolas"
  | "monospace";

export type TerminalShell = "powershell.exe" | "pwsh" | "cmd.exe" | "bash" | "zsh";

export interface AppSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  fontLigatures: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  theme: AppTheme;
  fontFamily: EditorFontFamily;
  terminalShell: TerminalShell;
  showMinimap: boolean;
}

const SETTINGS_KEY = "grovenotes:settings";

const DEFAULTS: AppSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  fontLigatures: true,
  autoSave: false,
  autoSaveDelay: 1000,
  theme: "dark",
  fontFamily: "JetBrains Mono",
  terminalShell: "powershell.exe",
  showMinimap: false,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {}
  return DEFAULTS;
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

interface SettingsState extends AppSettings {
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadSettings(),

  update: (patch) =>
    set((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    }),

  reset: () =>
    set(() => {
      saveSettings(DEFAULTS);
      return { ...DEFAULTS };
    }),
}));
