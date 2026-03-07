import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../store/editorStore";
import { openFileByPath } from "../tauri/files";
import { currentEditorView } from "../editorRef";
import { EditorView } from "codemirror";
import { EditorSelection } from "@codemirror/state";
import type { TabState } from "../types/editor";

interface SearchMatch {
  path: string;
  line: number;
  line_content: string;
}

interface GroupedResult {
  path: string;
  label: string;
  matches: SearchMatch[];
}

function groupResults(matches: SearchMatch[]): GroupedResult[] {
  const map = new Map<string, SearchMatch[]>();
  for (const m of matches) {
    if (!map.has(m.path)) map.set(m.path, []);
    map.get(m.path)!.push(m);
  }
  return Array.from(map.entries()).map(([path, ms]) => ({
    path,
    label: path.split(/[/\\]/).pop() ?? path,
    matches: ms,
  }));
}

export function ProjectSearch() {
  const { projectSearchOpen, toggleProjectSearch, workspaceRoot, addTabOrFocus, tabs } =
    useEditorStore();
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (projectSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [projectSearchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && projectSearchOpen) {
        e.preventDefault();
        toggleProjectSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projectSearchOpen, toggleProjectSearch]);

  const runSearch = useCallback(
    async (q: string, cs: boolean) => {
      if (!workspaceRoot || q.trim().length < 2) {
        setResults([]);
        setResultCount(0);
        return;
      }
      setSearching(true);
      try {
        const matches = await invoke<SearchMatch[]>("search_in_files", {
          root: workspaceRoot,
          query: q,
          caseSensitive: cs,
        });
        setTruncated(matches.length >= 500);
        setResultCount(matches.length);
        setResults(groupResults(matches));
      } catch (e) {
        console.error("search_in_files failed", e);
      } finally {
        setSearching(false);
      }
    },
    [workspaceRoot],
  );

  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q, caseSensitive), 350);
  };

  const handleCaseToggle = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    runSearch(query, next);
  };

  const handleMatchClick = async (match: SearchMatch) => {
    const norm = match.path.replace(/\\/g, "/");
    const existing = tabs.find((t: TabState) => t.path?.replace(/\\/g, "/") === norm);
    let tabId: string | null = null;

    if (existing) {
      useEditorStore.getState().setActiveTab(existing.id);
      tabId = existing.id;
    } else {
      const result = await openFileByPath(match.path);
      if (result) {
        tabId = addTabOrFocus({ ...result, dirty: false });
      }
    }

    if (tabId == null) return;

    // Wait a tick for the editor to mount, then jump to line.
    setTimeout(() => {
      const view = currentEditorView;
      if (!view) return;
      const doc = view.state.doc;
      if (match.line > doc.lines) return;
      const lineObj = doc.line(match.line);
      view.dispatch({
        selection: EditorSelection.cursor(lineObj.from),
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(lineObj.from, { y: "center" }),
      });
      view.focus();
    }, 80);
  };

  if (!projectSearchOpen) return null;

  const noWorkspace = !workspaceRoot;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={toggleProjectSearch} />
      <div
        className="fixed top-12 right-4 z-50 flex flex-col w-[480px] max-h-[calc(100vh-5rem)] rounded-xl border border-[var(--border-default)] shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Search in Files</span>
          <span className="ml-auto text-xs text-[var(--text-muted)]">Ctrl+Shift+F</span>
          <button
            type="button"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            onClick={toggleProjectSearch}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] focus-within:border-[var(--accent)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={noWorkspace ? "Open a folder to search…" : "Search text…"}
              disabled={noWorkspace}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            {searching && (
              <span className="text-xs text-[var(--text-muted)] animate-pulse">Searching…</span>
            )}
            <button
              type="button"
              title="Match case"
              onClick={handleCaseToggle}
              className={`px-1.5 py-0.5 rounded text-xs font-semibold border transition-colors ${
                caseSensitive
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              Aa
            </button>
          </div>
          {resultCount > 0 && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {truncated ? `500+ matches` : `${resultCount} match${resultCount !== 1 ? "es" : ""}`} in {results.length} file{results.length !== 1 ? "s" : ""}
            </p>
          )}
          {!searching && query.trim().length >= 2 && resultCount === 0 && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">No matches found.</p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {results.map((group) => (
            <div key={group.path} className="border-b border-[var(--border-subtle)] last:border-0">
              <div
                className="flex items-center gap-2 px-4 py-1.5 sticky top-0"
                style={{ background: "var(--bg-overlay)" }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M2 2h9l3 3v9H2V2z" />
                </svg>
                <span className="text-xs font-semibold text-[var(--text-secondary)] truncate" title={group.path}>
                  {group.label}
                </span>
                <span
                  className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "var(--badge-bg, var(--bg-hover))", color: "var(--accent)" }}
                >
                  {group.matches.length}
                </span>
              </div>
              {group.matches.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full flex items-start gap-3 px-4 py-1.5 hover:bg-[var(--bg-hover)] text-left transition-colors"
                  onClick={() => handleMatchClick(m)}
                >
                  <span
                    className="flex-shrink-0 text-[10px] font-mono mt-0.5 w-8 text-right tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {m.line}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-secondary)] truncate leading-5">
                    {m.line_content}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {results.length === 0 && !searching && !noWorkspace && query.trim().length < 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" className="mb-3">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">Type 2+ characters to search</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
