import type { EditorView } from "codemirror";

/** Current CodeMirror view; set by EditorPane so menu/commands can run undo/redo etc. */
export let currentEditorView: EditorView | null = null;

export function setCurrentEditorView(view: EditorView | null): void {
  currentEditorView = view;
}
