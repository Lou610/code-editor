import { useEditorStore } from "../store/editorStore";

const SHORTCUTS: { category: string; items: { keys: string[]; action: string }[] }[] = [
  {
    category: "File",
    items: [
      { keys: ["Ctrl", "N"], action: "New file" },
      { keys: ["Ctrl", "O"], action: "Open file" },
      { keys: ["Ctrl", "S"], action: "Save" },
      { keys: ["Ctrl", "Shift", "S"], action: "Save As" },
      { keys: ["Ctrl", "W"], action: "Close active tab" },
    ],
  },
  {
    category: "Tabs",
    items: [
      { keys: ["Ctrl", "W"], action: "Close active tab" },
      { keys: ["Ctrl", "Tab"], action: "Next tab" },
      { keys: ["Ctrl", "Shift", "Tab"], action: "Previous tab" },
    ],
  },
  {
    category: "Edit",
    items: [
      { keys: ["Ctrl", "Z"], action: "Undo" },
      { keys: ["Ctrl", "Y"], action: "Redo" },
      { keys: ["Ctrl", "X"], action: "Cut" },
      { keys: ["Ctrl", "C"], action: "Copy" },
      { keys: ["Ctrl", "V"], action: "Paste" },
      { keys: ["Ctrl", "A"], action: "Select all" },
    ],
  },
  {
    category: "Search",
    items: [
      { keys: ["Ctrl", "F"], action: "Open Find panel" },
      { keys: ["Ctrl", "H"], action: "Open Find & Replace panel" },
      { keys: ["Ctrl", "Shift", "F"], action: "Search in Files" },
      { keys: ["Ctrl", "G"], action: "Go to Line" },
      { keys: ["Enter"], action: "Find next match" },
      { keys: ["Shift", "Enter"], action: "Find previous match" },
      { keys: ["Escape"], action: "Close Find / Search panel" },
    ],
  },
  {
    category: "View",
    items: [
      { keys: ["Ctrl", "`"], action: "Toggle terminal" },
      { keys: ["Ctrl", "B"], action: "Toggle sidebar" },
      { keys: ["Ctrl", ","], action: "Open Settings" },
      { keys: ["Ctrl", "K"], action: "Open Keyboard Shortcuts" },
      { keys: ["Ctrl", "Alt", "L"], action: "Toggle LSP panel" },
      { keys: ["Ctrl", "Alt", "R"], action: "Restart LSP" },
    ],
  },
  {
    category: "Editor",
    items: [
      { keys: ["Tab"], action: "Indent selection" },
      { keys: ["Shift", "Tab"], action: "De-indent selection" },
      { keys: ["Ctrl", "/"], action: "Toggle line comment" },
      { keys: ["Alt", "↑"], action: "Move line up" },
      { keys: ["Alt", "↓"], action: "Move line down" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded text-[11px] font-semibold"
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border-muted)",
        color: "var(--text-secondary)",
        boxShadow: "0 1px 0 var(--border-muted)",
        fontFamily: "inherit",
      }}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts() {
  const { shortcutsOpen, toggleShortcuts } = useEditorStore();

  if (!shortcutsOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={toggleShortcuts}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
      >
        <div
          className="w-full max-w-lg rounded-xl border border-[var(--border-default)] shadow-2xl flex flex-col max-h-[85vh]"
          style={{ background: "var(--bg-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <span className="text-[var(--accent)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="13" rx="2" />
                  <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 14h.01M18 14h.01" />
                </svg>
              </span>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
            </div>
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              onClick={toggleShortcuts}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {SHORTCUTS.map((group) => (
              <div key={group.category}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">
                  {group.category}
                </h3>
                <div
                  className="rounded-lg border border-[var(--border-default)] overflow-hidden"
                  style={{ background: "var(--bg-overlay)" }}
                >
                  {group.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <span className="text-sm text-[var(--text-secondary)]">{item.action}</span>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                        {item.keys.map((k, ki) => (
                          <span key={ki} className="flex items-center gap-1">
                            {ki > 0 && (
                              <span className="text-[var(--text-muted)] text-[10px]">+</span>
                            )}
                            <Kbd>{k}</Kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end px-5 py-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              className="px-4 h-8 rounded-md text-sm font-medium text-white transition-colors"
              style={{ background: "var(--accent)" }}
              onClick={toggleShortcuts}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
