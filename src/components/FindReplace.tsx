import { useCallback, useEffect, useRef, useState } from "react";
import type { editor as MonacoEditorNS } from "monaco-editor";
import { useEditorStore } from "../store/editorStore";
import { currentEditor } from "../editorRef";

function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M11 11l3 3" />
    </svg>
  );
}

function IconReplace() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h7a3 3 0 0 1 0 6H3" />
      <path d="M5 3L3 5l2 2" />
      <path d="M3 13h7" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 10l4-4 4 4" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

const toggleBtn = (active: boolean) =>
  `flex items-center justify-center w-7 h-7 rounded-md text-xs font-semibold transition-colors flex-shrink-0 ` +
  (active
    ? "bg-[var(--accent)] text-white shadow-sm"
    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]");

const iconBtn =
  "flex items-center justify-center w-7 h-7 rounded-md transition-colors flex-shrink-0 " +
  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]";

const actionBtn =
  "px-3 h-7 rounded-md text-xs font-medium transition-colors flex-shrink-0 " +
  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] " +
  "border border-[var(--border-subtle)] hover:border-[var(--border-default)]";

const inputClass =
  "h-7 pl-7 pr-2 rounded-md text-sm bg-[var(--bg-base)] border border-[var(--border-subtle)] " +
  "text-[var(--text-primary)] placeholder-[var(--text-muted)] " +
  "focus:border-[var(--accent)] focus:outline-none transition-colors w-full";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchPattern(find: string, useRegex: boolean, wholeWord: boolean): { pattern: string; isRegex: boolean } {
  if (!find) return { pattern: "", isRegex: false };

  if (useRegex) {
    if (wholeWord) return { pattern: `\\b(?:${find})\\b`, isRegex: true };
    return { pattern: find, isRegex: true };
  }

  if (wholeWord) return { pattern: `\\b${escapeRegex(find)}\\b`, isRegex: true };
  return { pattern: find, isRegex: false };
}

function getAllMatches(
  model: MonacoEditorNS.ITextModel,
  find: string,
  useRegex: boolean,
  caseSensitive: boolean,
  wholeWord: boolean,
): MonacoEditorNS.FindMatch[] {
  const { pattern, isRegex } = buildSearchPattern(find, useRegex, wholeWord);
  if (!pattern) return [];
  return model.findMatches(pattern, false, isRegex, caseSensitive, null, false);
}

export function FindReplace() {
  const { findReplaceOpen, toggleFindReplace } = useEditorStore();
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [stats, setStats] = useState({ count: 0, current: 0 });
  const [regexError, setRegexError] = useState<string | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (findReplaceOpen) {
      setTimeout(() => findInputRef.current?.focus(), 40);
    }
  }, [findReplaceOpen]);

  const refreshStats = useCallback(() => {
    const editor = currentEditor;
    const model = editor?.getModel();
    if (!editor || !model || !find) {
      setStats({ count: 0, current: 0 });
      setRegexError(null);
      return;
    }

    try {
      const matches = getAllMatches(model, find, regex, caseSensitive, wholeWord);
      const selection = editor.getSelection();
      const current = selection
        ? matches.findIndex((m) => m.range.equalsRange(selection)) + 1
        : 0;
      setStats({ count: matches.length, current: current > 0 ? current : 0 });
      setRegexError(null);
    } catch {
      setStats({ count: 0, current: 0 });
      setRegexError("Invalid regex");
    }
  }, [find, regex, caseSensitive, wholeWord]);

  useEffect(() => {
    if (!findReplaceOpen) {
      setStats({ count: 0, current: 0 });
      setRegexError(null);
      return;
    }
    refreshStats();
  }, [findReplaceOpen, refreshStats]);

  useEffect(() => {
    if (!findReplaceOpen) return;
    refreshStats();
  }, [find, regex, caseSensitive, wholeWord, findReplaceOpen, refreshStats]);

  const close = () => toggleFindReplace();

  const findOne = (next: boolean) => {
    const editor = currentEditor;
    const model = editor?.getModel();
    if (!editor || !model || !find) return;

    try {
      const { pattern, isRegex } = buildSearchPattern(find, regex, wholeWord);
      const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 };
      const primary = next
        ? model.findNextMatch(pattern, pos, isRegex, caseSensitive, null, false)
        : model.findPreviousMatch(pattern, pos, isRegex, caseSensitive, null, false);

      const fallbackPos = next
        ? { lineNumber: 1, column: 1 }
        : { lineNumber: model.getLineCount(), column: model.getLineMaxColumn(model.getLineCount()) };
      const match = primary ?? (next
        ? model.findNextMatch(pattern, fallbackPos, isRegex, caseSensitive, null, false)
        : model.findPreviousMatch(pattern, fallbackPos, isRegex, caseSensitive, null, false));

      if (!match) return;
      editor.setSelection(match.range);
      editor.revealRangeInCenter(match.range);
      editor.focus();
      refreshStats();
    } catch {
      setRegexError("Invalid regex");
    }
  };

  const handleReplaceNext = () => {
    const editor = currentEditor;
    const model = editor?.getModel();
    if (!editor || !model || !find) return;

    try {
      const { pattern, isRegex } = buildSearchPattern(find, regex, wholeWord);
      const selection = editor.getSelection();
      let match: MonacoEditorNS.FindMatch | null = null;

      if (selection) {
        const selectedText = model.getValueInRange(selection);
        const selectedMatches = model.findMatches(pattern, false, isRegex, caseSensitive, null, false);
        const selectedMatch = selectedMatches.find((m) => m.range.equalsRange(selection));
        if (selectedMatch && selectedText.length > 0) {
          match = selectedMatch;
        }
      }

      if (!match) {
        const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 };
        match = model.findNextMatch(pattern, pos, isRegex, caseSensitive, null, false);
      }

      if (!match) return;

      editor.executeEdits("find-replace", [{ range: match.range, text: replace }]);
      editor.setPosition({ lineNumber: match.range.startLineNumber, column: match.range.startColumn + replace.length });
      findOne(true);
      refreshStats();
    } catch {
      setRegexError("Invalid regex");
    }
  };

  const handleReplaceAll = () => {
    const editor = currentEditor;
    const model = editor?.getModel();
    if (!editor || !model || !find) return;

    try {
      const matches = getAllMatches(model, find, regex, caseSensitive, wholeWord);
      if (matches.length === 0) return;

      const edits = [...matches]
        .reverse()
        .map((m) => ({ range: m.range, text: replace }));

      editor.executeEdits("find-replace-all", edits);
      editor.focus();
      refreshStats();
    } catch {
      setRegexError("Invalid regex");
    }
  };

  const onFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? findOne(false) : findOne(true);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const onReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleReplaceNext();
    }
  };

  if (!findReplaceOpen) return null;

  return (
    <div
      className="flex flex-col gap-1.5 px-3 py-2 border-b border-[var(--border-subtle)] select-none"
      style={{ background: "var(--bg-overlay)" }}
    >
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 max-w-xs min-w-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            <IconSearch />
          </span>
          <input
            ref={findInputRef}
            type="text"
            placeholder="Find"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={onFindKeyDown}
            className={inputClass}
            spellCheck={false}
          />
        </div>

        <button
          type="button"
          className={toggleBtn(caseSensitive)}
          title="Match case"
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </button>
        <button
          type="button"
          className={toggleBtn(regex)}
          title="Use regular expression"
          onClick={() => setRegex((v) => !v)}
        >
          .*
        </button>
        <button
          type="button"
          className={toggleBtn(wholeWord)}
          title="Match whole word"
          onClick={() => setWholeWord((v) => !v)}
        >
          W
        </button>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5 flex-shrink-0" />

        <button
          type="button"
          className={iconBtn}
          title="Previous match (Shift+Enter)"
          onClick={() => findOne(false)}
        >
          <IconChevronUp />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Next match (Enter)"
          onClick={() => findOne(true)}
        >
          <IconChevronDown />
        </button>

        <div className="min-w-[56px] text-right text-xs text-[var(--text-muted)] tabular-nums">
          {regexError ? regexError : stats.count > 0 ? `${stats.current || 1}/${stats.count}` : "0/0"}
        </div>

        <button
          type="button"
          className={iconBtn}
          title="Close (Escape)"
          onClick={close}
        >
          <IconClose />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 max-w-xs min-w-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            <IconReplace />
          </span>
          <input
            type="text"
            placeholder="Replace"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={onReplaceKeyDown}
            className={inputClass}
            spellCheck={false}
          />
        </div>

        <button type="button" className={actionBtn} onClick={handleReplaceNext}>
          Replace
        </button>
        <button type="button" className={actionBtn} onClick={handleReplaceAll}>
          Replace All
        </button>
      </div>
    </div>
  );
}
