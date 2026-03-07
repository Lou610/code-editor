import { useEditorStore } from "../store/editorStore";
import { APP_THEMES, type AppTheme, useSettingsStore } from "../store/settingsStore";

const THEME_META: Record<AppTheme, { label: string; swatch: string }> = {
  dark: { label: "Dark", swatch: "linear-gradient(135deg, #0f1117, #1b2230)" },
  light: { label: "Light", swatch: "linear-gradient(135deg, #ffffff, #dfe6ee)" },
  ocean: { label: "Ocean", swatch: "linear-gradient(135deg, #0a1a2f, #0f4d75)" },
  forest: { label: "Forest", swatch: "linear-gradient(135deg, #101b16, #245a46)" },
  sunset: { label: "Sunset", swatch: "linear-gradient(135deg, #fff7ed, #ffb98a)" },
};

// ── Reusable primitives ───────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-1"
        }`}
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 border-b border-[var(--border-subtle)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1 px-1">
        {title}
      </h3>
      <div
        className="rounded-lg border border-[var(--border-default)] px-4"
        style={{ background: "var(--bg-overlay)" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function SettingsModal() {
  const { settingsOpen, toggleSettings } = useEditorStore();
  const {
    fontSize, tabSize, wordWrap, fontLigatures,
    autoSave, autoSaveDelay,
    theme, fontFamily, terminalShell, showMinimap,
    update, reset,
  } = useSettingsStore();

  if (!settingsOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={toggleSettings}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div
          className="w-full max-w-md rounded-xl border border-[var(--border-default)] shadow-2xl flex flex-col max-h-[90vh]"
          style={{ background: "var(--bg-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <span className="text-[var(--accent)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M19.07 4.93A10 10 0 0 1 4.93 19.07M19.07 4.93l-2.83 2.83M4.93 19.07l2.83-2.83" />
                  <path d="M2 12h3M19 12h3M12 2v3M12 19v3" />
                </svg>
              </span>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Settings</h2>
            </div>
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              onClick={toggleSettings}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <Section title="Appearance">
              <Row label="Theme" description="Color theme for the interface">
                <div className="flex flex-wrap gap-2 max-w-[280px] justify-end">
                  {APP_THEMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update({ theme: t })}
                      className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium border transition-colors ${
                        theme === t
                          ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-muted)]"
                          : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-full border border-white/20"
                        style={{ background: THEME_META[t].swatch }}
                      />
                      {THEME_META[t].label}
                    </button>
                  ))}
                </div>
              </Row>
            </Section>

            <Section title="Editor">
              <Row label="Font Family" description="Monospace font for the editor">
                <select
                  value={fontFamily}
                  onChange={(e) => update({ fontFamily: e.target.value as typeof fontFamily })}
                  className="h-7 pl-2 pr-7 rounded-md text-sm bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                >
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Cascadia Code">Cascadia Code</option>
                  <option value="Source Code Pro">Source Code Pro</option>
                  <option value="Consolas">Consolas</option>
                  <option value="monospace">System Monospace</option>
                </select>
              </Row>
              <Row
                label="Font Size"
                description="Editor text size in pixels"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-md border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-lg leading-none"
                    onClick={() => update({ fontSize: Math.max(10, fontSize - 1) })}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                    {fontSize}
                  </span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-md border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-lg leading-none"
                    onClick={() => update({ fontSize: Math.min(32, fontSize + 1) })}
                  >
                    +
                  </button>
                </div>
              </Row>

              <Row label="Tab Size" description="Spaces per indentation level">
                <select
                  value={tabSize}
                  onChange={(e) => update({ tabSize: Number(e.target.value) })}
                  className="h-7 pl-2 pr-7 rounded-md text-sm bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                  <option value={8}>8 spaces</option>
                </select>
              </Row>

              <Row label="Word Wrap" description="Soft-wrap long lines in the editor">
                <Toggle checked={wordWrap} onChange={(v) => update({ wordWrap: v })} />
              </Row>

              <Row label="Font Ligatures" description="Enable programming ligatures (JetBrains Mono)">
                <Toggle checked={fontLigatures} onChange={(v) => update({ fontLigatures: v })} />
              </Row>
              <Row label="Minimap" description="Show a code overview on the right side of the editor">
                <Toggle checked={showMinimap} onChange={(v) => update({ showMinimap: v })} />
              </Row>
            </Section>

            <Section title="Terminal">
              <Row label="Shell" description="Shell program for the integrated terminal">
                <select
                  value={terminalShell}
                  onChange={(e) => update({ terminalShell: e.target.value as typeof terminalShell })}
                  className="h-7 pl-2 pr-7 rounded-md text-sm bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                >
                  <option value="powershell.exe">PowerShell (powershell.exe)</option>
                  <option value="pwsh">PowerShell 7+ (pwsh)</option>
                  <option value="cmd.exe">Command Prompt (cmd.exe)</option>
                  <option value="bash">Bash</option>
                  <option value="zsh">Zsh</option>
                </select>
              </Row>
            </Section>

            <Section title="Saving">
              <Row label="Auto Save" description="Automatically save files after you stop typing">
                <Toggle checked={autoSave} onChange={(v) => update({ autoSave: v })} />
              </Row>
              {autoSave && (
                <Row label="Auto Save Delay" description="Milliseconds of inactivity before saving">
                  <select
                    value={autoSaveDelay}
                    onChange={(e) => update({ autoSaveDelay: Number(e.target.value) })}
                    className="h-7 pl-2 pr-7 rounded-md text-sm bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value={500}>500 ms</option>
                    <option value={1000}>1 s</option>
                    <option value={2000}>2 s</option>
                    <option value={5000}>5 s</option>
                  </select>
                </Row>
              )}
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              onClick={reset}
            >
              Reset to defaults
            </button>
            <button
              type="button"
              className="px-4 h-8 rounded-md text-sm font-medium transition-colors text-white"
              style={{ background: "var(--accent)" }}
              onClick={toggleSettings}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
