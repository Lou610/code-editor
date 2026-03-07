import { useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import type { LanguageId, LineEnding, TabState } from "../types/editor";

const LANG_LABELS: Record<LanguageId, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  rust: "Rust",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  java: "Java",
  go: "Go",
  php: "PHP",
  ruby: "Ruby",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
  markdown: "Markdown",
  sql: "SQL",
  bash: "Bash",
  xml: "XML",
  plain: "Plain Text",
};

const LINE_ENDINGS: { id: LineEnding; label: string; desc: string }[] = [
  { id: "LF", label: "LF", desc: "Unix (\\n)" },
  { id: "CRLF", label: "CRLF", desc: "Windows (\\r\\n)" },
  { id: "CR", label: "CR", desc: "Classic Mac (\\r)" },
];

function convertLineEndings(content: string, to: LineEnding): string {
  const lf = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (to === "LF") return lf;
  if (to === "CRLF") return lf.replace(/\n/g, "\r\n");
  return lf.replace(/\n/g, "\r");
}

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export function StatusBar() {
  const { tabs, activeTabId, setTabLanguage, cursorLine, cursorCol, gitBranch } = useEditorStore();
  const activeTab = tabs.find((t: TabState) => t.id === activeTabId);

  const [leMenuOpen, setLeMenuOpen] = useState(false);
  const leRef = useRef<HTMLDivElement>(null);

  const totalLines = activeTab ? activeTab.content.split("\n").length : 0;
  const wordCount = activeTab ? countWords(activeTab.content) : 0;
  const charCount = activeTab ? activeTab.content.length : 0;

  const handleLineEndingChange = (le: LineEnding) => {
    setLeMenuOpen(false);
    if (!activeTab) return;
    const converted = convertLineEndings(activeTab.content, le);
    useEditorStore.setState((s: { tabs: TabState[] }) => ({
      tabs: s.tabs.map((t: TabState) =>
        t.id === activeTab.id ? { ...t, content: converted, lineEnding: le, dirty: true } : t,
      ),
    }));
  };

  return (
    <footer
      className="flex items-center h-7 min-h-7 px-3 gap-3 text-xs border-t border-[var(--border-subtle)]"
      style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }}
    >
      {/* Language selector */}
      <select
        className="h-5 pl-2 pr-6 rounded-md bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer focus:border-[var(--accent)] transition-colors"
        value={activeTab?.language ?? "plain"}
        onChange={(e) => activeTab && setTabLanguage(activeTab.id, e.target.value as LanguageId)}
        title="Language mode"
      >
        {Object.entries(LANG_LABELS).map(([id, label]) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>

      {/* Git branch */}
      {gitBranch && (
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded font-mono"
          style={{ background: "var(--badge-bg)", color: "var(--accent)" }}
          title="Git branch"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="6" r="1.5" />
            <path d="M5 4.5v7M5 4.5C5 7 11 7.5 11 6" />
          </svg>
          {gitBranch}
        </span>
      )}

      {/* Cursor + total lines */}
      <span className="px-2 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-muted)] font-mono">
        Ln {cursorLine}, Col {cursorCol}
        {totalLines > 0 && (
          <span className="opacity-60"> / {totalLines}</span>
        )}
      </span>

      {/* Word + char count */}
      {activeTab && (
        <span className="px-2 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-muted)]" title={`${charCount} characters`}>
          {wordCount} words
        </span>
      )}

      {/* Encoding */}
      <span className="px-2 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-muted)]">
        {activeTab?.encoding ?? "UTF-8"}
      </span>

      {/* Line ending picker */}
      <div className="relative" ref={leRef}>
        <button
          type="button"
          className="px-2 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Change line endings"
          onClick={() => setLeMenuOpen((o) => !o)}
        >
          {activeTab?.lineEnding ?? "LF"}
        </button>
        {leMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLeMenuOpen(false)} />
            <div
              className="absolute bottom-full mb-1 right-0 z-50 py-1 rounded-lg border border-[var(--border-default)] shadow-lg min-w-[160px]"
              style={{ background: "var(--bg-overlay)" }}
            >
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Convert Line Endings
              </p>
              {LINE_ENDINGS.map((le) => (
                <button
                  key={le.id}
                  type="button"
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--bg-hover)] ${
                    activeTab?.lineEnding === le.id ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                  }`}
                  onClick={() => handleLineEndingChange(le.id)}
                >
                  <span className="font-semibold w-10">{le.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{le.desc}</span>
                  {activeTab?.lineEnding === le.id && (
                    <svg className="ml-auto" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 8l4 4 6-7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      <span className="text-[var(--text-muted)]">Ready</span>
    </footer>
  );
}
