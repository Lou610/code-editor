import { create } from "zustand";

/** Maps tabId → noteId for tabs opened from GroveNotes. */
interface GnState {
  /** noteId → tabId */
  openByNoteId: Record<string, string>;
  /** tabId → noteId */
  noteByTabId: Record<string, string>;
  register: (noteId: string, tabId: string) => void;
  unregisterTab: (tabId: string) => void;
  getNoteId: (tabId: string) => string | null;
  getTabId: (noteId: string) => string | null;
}

export const useGroveNotesStore = create<GnState>((set, get) => ({
  openByNoteId: {},
  noteByTabId: {},

  register: (noteId, tabId) =>
    set((s) => ({
      openByNoteId: { ...s.openByNoteId, [noteId]: tabId },
      noteByTabId: { ...s.noteByTabId, [tabId]: noteId },
    })),

  unregisterTab: (tabId) =>
    set((s) => {
      const noteId = s.noteByTabId[tabId];
      const openByNoteId = { ...s.openByNoteId };
      const noteByTabId = { ...s.noteByTabId };
      if (noteId) delete openByNoteId[noteId];
      delete noteByTabId[tabId];
      return { openByNoteId, noteByTabId };
    }),

  getNoteId: (tabId) => get().noteByTabId[tabId] ?? null,
  getTabId: (noteId) => get().openByNoteId[noteId] ?? null,
}));
