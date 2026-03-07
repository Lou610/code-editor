import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { currentEditor, gotoLine } from "../editorRef";
import type { TabState } from "../types/editor";

export function GotoLine() {
  const { gotoLineOpen, toggleGotoLine, tabs, activeTabId } = useEditorStore();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t: TabState) => t.id === activeTabId);
  const totalLines = activeTab ? activeTab.content.split("\n").length : 0;

  useEffect(() => {
    if (gotoLineOpen) {
      setValue("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [gotoLineOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gotoLineOpen) {
        e.preventDefault();
        toggleGotoLine();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gotoLineOpen, toggleGotoLine]);

  const jump = () => {
    const model = currentEditor?.getModel();
    if (!model) return;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) {
      setError("Enter a valid line number.");
      return;
    }
    if (num > model.getLineCount()) {
      setError(`File only has ${model.getLineCount()} lines.`);
      return;
    }
    gotoLine(num);
    toggleGotoLine();
  };

  if (!gotoLineOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={toggleGotoLine} />
      <div
        className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-80 rounded-xl border border-[var(--border-default)] shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="14" y2="12" />
            <line x1="4" y1="18" x2="17" y2="18" />
          </svg>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Go to Line</span>
          {totalLines > 0 && (
            <span className="ml-auto text-xs text-[var(--text-muted)]">of {totalLines}</span>
          )}
        </div>
        <div className="px-4 py-3">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={totalLines || undefined}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); jump(); }
            }}
            placeholder="Line number…"
            className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {error && (
            <p className="mt-1.5 text-xs text-red-400">{error}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="flex-1 h-8 rounded-lg text-sm font-medium transition-colors text-white"
              style={{ background: "var(--accent)" }}
              onClick={jump}
            >
              Jump
            </button>
            <button
              type="button"
              className="h-8 px-4 rounded-lg text-sm font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={toggleGotoLine}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
