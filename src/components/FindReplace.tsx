import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { currentEditorView } from "../editorRef";
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceNext as cmReplaceNext,
  replaceAll as cmReplaceAll,
  setSearchQuery,
} from "@codemirror/search";

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

export function FindReplace() {
  const { findReplaceOpen, toggleFindReplace } = useEditorStore();
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus find input when panel opens
  useEffect(() => {
    if (findReplaceOpen) {
      setTimeout(() => findInputRef.current?.focus(), 40);
    }
  }, [findReplaceOpen]);

  const applyQuery = useCallback(
    (opts?: { f?: string; r?: string; rx?: boolean; cs?: boolean; ww?: boolean }) => {
      const view = currentEditorView;
      if (!view) return false;
      try {
        const query = new SearchQuery({
          search: opts?.f ?? find,
          replace: opts?.r ?? replace,
          regexp: opts?.rx ?? regex,
          caseSensitive: opts?.cs ?? caseSensitive,
          wholeWord: opts?.ww ?? wholeWord,
        });
        view.dispatch({ effects: setSearchQuery.of(query) });
        return true;
      } catch {
        return false; // invalid regex – swallow silently
      }
    },
    [find, replace, regex, caseSensitive, wholeWord],
  );

  // Push search query to editor whenever anything changes while panel is open
  useEffect(() => {
    if (findReplaceOpen) applyQuery();
  }, [find, replace, regex, caseSensitive, wholeWord, findReplaceOpen, applyQuery]);

  // Clear highlights when panel closes
  useEffect(() => {
    if (!findReplaceOpen) {
      const view = currentEditorView;
      if (view) {
        view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
      }
    }
  }, [findReplaceOpen]);

  if (!findReplaceOpen) return null;

  const close = () => toggleFindReplace();

  const handleFindNext = () => {
    const view = currentEditorView;
    if (!view) return;
    applyQuery();
    findNext(view);
    view.focus();
  };

  const handleFindPrev = () => {
    const view = currentEditorView;
    if (!view) return;
    applyQuery();
    findPrevious(view);
    view.focus();
  };

  const handleReplaceNext = () => {
    const view = currentEditorView;
    if (!view) return;
    applyQuery();
    cmReplaceNext(view);
    view.focus();
  };

  const handleReplaceAll = () => {
    const view = currentEditorView;
    if (!view) return;
    applyQuery();
    cmReplaceAll(view);
    view.focus();
  };

  const onFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? handleFindPrev() : handleFindNext();
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

  return (
    <div
      className="flex flex-col gap-1.5 px-3 py-2 border-b border-[var(--border-subtle)] select-none"
      style={{ background: "var(--bg-overlay)" }}
    >
      {/* Row 1 — Find */}
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

        {/* Option toggles */}
        <button
          type="button"
          className={toggleBtn(caseSensitive)}
          title="Match case (Alt+C)"
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </button>
        <button
          type="button"
          className={toggleBtn(regex)}
          title="Use regular expression (Alt+R)"
          onClick={() => setRegex((v) => !v)}
        >
          .*
        </button>
        <button
          type="button"
          className={toggleBtn(wholeWord)}
          title="Match whole word (Alt+W)"
          onClick={() => setWholeWord((v) => !v)}
        >
          W
        </button>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5 flex-shrink-0" />

        <button
          type="button"
          className={iconBtn}
          title="Previous match (Shift+Enter)"
          onClick={handleFindPrev}
        >
          <IconChevronUp />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Next match (Enter)"
          onClick={handleFindNext}
        >
          <IconChevronDown />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          className={iconBtn}
          title="Close (Escape)"
          onClick={close}
        >
          <IconClose />
        </button>
      </div>

      {/* Row 2 — Replace */}
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
