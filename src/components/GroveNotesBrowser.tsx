import { useState, useEffect, useCallback } from "react";
import { useEditorStore } from "../store/editorStore";
import { useSettingsStore } from "../store/settingsStore";
import { useGroveNotesStore } from "../store/groveNotesStore";
import { listGroveNotes, fetchGroveNote, pushGroveNote, type GroveNote } from "../tauri/groveNotes";
import { message } from "@tauri-apps/plugin-dialog";

// ── Icons ────────────────────────────────────────────────────────────────────

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13H3a9 9 0 0 0 9 9v-2z" />
      <path d="M20.5 2.5a10 10 0 0 0-10 10v1.5A7.5 7.5 0 0 0 18 6.5h2.5V2.5z" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={spinning ? { animation: "spin 1s linear infinite" } : undefined}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GroveNotesBrowser() {
  const { gnBrowserOpen, toggleGnBrowser, addTab, setActiveTab, tabs, activeTabId } = useEditorStore();
  const { groveNotesUrl, groveNotesApiKey } = useSettingsStore();
  const { register, getNoteId, getTabId, unregisterTab } = useGroveNotesStore();

  const [notes, setNotes] = useState<GroveNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const configured = !!(groveNotesUrl && groveNotesApiKey);

  const activeNoteId = activeTabId ? getNoteId(activeTabId) : null;

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await listGroveNotes();
      setNotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gnBrowserOpen && configured) refresh();
  }, [gnBrowserOpen, configured, refresh]);

  // Unregister tabs when they're closed from the editor
  useEffect(() => {
    return useEditorStore.subscribe((state, prev) => {
      const closedIds = prev.tabs
        .map((t) => t.id)
        .filter((id) => !state.tabs.some((t) => t.id === id));
      closedIds.forEach(unregisterTab);
    });
  }, [unregisterTab]);

  const handleOpen = async (note: GroveNote) => {
    const existingTabId = getTabId(note.id);
    if (existingTabId && tabs.some((t) => t.id === existingTabId)) {
      setActiveTab(existingTabId);
      toggleGnBrowser();
      return;
    }

    setOpeningId(note.id);
    try {
      const data = await fetchGroveNote(note.id);
      const label = (note.icon ? note.icon + " " : "") + (data.title || "Untitled") + ".md";
      const tabId = addTab({
        path: null,
        label,
        content: data.markdown,
        dirty: false,
        language: "markdown",
        encoding: "UTF-8",
        lineEnding: "LF",
      });
      register(note.id, tabId);
      toggleGnBrowser();
    } catch (e) {
      await message(e instanceof Error ? e.message : "Failed to open note", { title: "GroveNotes", kind: "error" });
    } finally {
      setOpeningId(null);
    }
  };

  const handleSync = async () => {
    if (!activeNoteId || !activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    setSyncingId(activeTabId);
    try {
      await pushGroveNote(activeNoteId, tab.content);
      await message("Note synced to GroveNotes successfully.", { title: "GroveNotes", kind: "info" });
    } catch (e) {
      await message(e instanceof Error ? e.message : "Sync failed", { title: "GroveNotes", kind: "error" });
    } finally {
      setSyncingId(null);
    }
  };

  if (!gnBrowserOpen) return null;

  const filtered = query.trim()
    ? notes.filter((n) =>
        [n.title, n.folder?.name ?? "", ...n.tags.map((t) => t.name)]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : notes;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={toggleGnBrowser}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="GroveNotes browser"
      >
        <div
          className="w-full max-w-lg rounded-xl border border-[var(--border-default)] shadow-2xl flex flex-col"
          style={{ background: "var(--bg-raised)", maxHeight: "80vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
            <span style={{ color: "var(--accent)" }}>
              <LeafIcon />
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex-1">GroveNotes</h2>

            {/* Sync button — only shown when the active tab is a GN note */}
            {activeNoteId && (
              <button
                type="button"
                title="Sync active tab back to GroveNotes"
                onClick={handleSync}
                disabled={!!syncingId}
                className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium border transition-colors disabled:opacity-50"
                style={{
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                  background: "var(--accent-muted)",
                }}
              >
                <CloudUploadIcon />
                {syncingId ? "Syncing…" : "Sync"}
              </button>
            )}

            <button
              type="button"
              title="Refresh note list"
              onClick={refresh}
              disabled={loading}
              className="flex items-center justify-center w-7 h-7 rounded-md border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <RefreshIcon spinning={loading} />
            </button>

            <button
              type="button"
              onClick={toggleGnBrowser}
              className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <XIcon />
            </button>
          </div>

          {/* Search */}
          {configured && (
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)]">
              <div
                className="flex items-center gap-2 px-3 h-8 rounded-lg border border-[var(--border-default)]"
                style={{ background: "var(--bg-base)" }}
              >
                <span className="text-[var(--text-muted)]"><SearchIcon /></span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter notes…"
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {!configured ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                <span className="text-[var(--text-muted)] text-3xl">🌿</span>
                <p className="text-sm text-[var(--text-primary)] font-medium">GroveNotes not configured</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Set your GroveNotes URL and API key in{" "}
                  <button
                    type="button"
                    className="underline text-[var(--accent)]"
                    onClick={() => {
                      toggleGnBrowser();
                      useEditorStore.getState().toggleSettings();
                    }}
                  >
                    Settings → GroveNotes Integration
                  </button>
                  .
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                <p className="text-sm text-red-400 font-medium">Failed to load notes</p>
                <p className="text-xs text-[var(--text-muted)]">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="px-4 h-7 rounded-md text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : loading && notes.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-[var(--text-muted)]">Loading notes…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-[var(--text-muted)]">
                  {query ? "No notes match your filter." : "No notes found."}
                </p>
              </div>
            ) : (
              <ul className="py-2">
                {filtered.map((note) => {
                  const isOpen = !!getTabId(note.id) && tabs.some((t) => t.id === getTabId(note.id));
                  const isOpening = openingId === note.id;
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => !isOpening && handleOpen(note)}
                        disabled={isOpening}
                        className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-60 group"
                      >
                        {/* Icon */}
                        <span className="text-lg leading-tight mt-0.5 flex-shrink-0 w-6 text-center">
                          {note.icon || "📄"}
                        </span>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {note.title || "Untitled"}
                            </span>
                            {isOpen && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                style={{
                                  background: "var(--accent-muted)",
                                  color: "var(--accent)",
                                }}
                              >
                                open
                              </span>
                            )}
                            {note.favorite && (
                              <span className="text-xs flex-shrink-0" title="Favorite">⭐</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
                            {note.folder && (
                              <>
                                <span className="truncate max-w-[140px]">{note.folder.name}</span>
                                <span>·</span>
                              </>
                            )}
                            <span>{formatDate(note.updatedAt)}</span>
                            {note.tags.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[120px]">
                                  {note.tags.map((t) => t.name).join(", ")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Open indicator */}
                        <span className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                          {isOpening ? "…" : isOpen ? "focus" : "open"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {configured && notes.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)]">
                {filtered.length} note{filtered.length !== 1 ? "s" : ""}
                {query && notes.length !== filtered.length ? ` of ${notes.length}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
