import type { editor, Selection } from "monaco-editor";

/** Current Monaco editor; set by EditorPane so menu/commands can run undo/redo etc. */
export let currentEditor: editor.IStandaloneCodeEditor | null = null;

export function setCurrentEditor(editorInstance: editor.IStandaloneCodeEditor | null): void {
  currentEditor = editorInstance;
}

export function runUndo() {
  currentEditor?.trigger("menu", "undo", null);
}

export function runRedo() {
  currentEditor?.trigger("menu", "redo", null);
}

export function runSelectAll() {
  currentEditor?.trigger("menu", "editor.action.selectAll", null);
}

export function runCopy() {
  currentEditor?.trigger("menu", "editor.action.clipboardCopyAction", null);
}

export function runCut() {
  currentEditor?.trigger("menu", "editor.action.clipboardCutAction", null);
}

export function runPaste() {
  currentEditor?.trigger("menu", "editor.action.clipboardPasteAction", null);
}

export function gotoLine(line: number) {
  const model = currentEditor?.getModel();
  if (!currentEditor || !model) return;
  const safeLine = Math.max(1, Math.min(line, model.getLineCount()));
  currentEditor.setPosition({ lineNumber: safeLine, column: 1 });
  currentEditor.revealLineInCenter(safeLine);
  currentEditor.focus();
}

export function setEditorSelection(selection: Selection) {
  currentEditor?.setSelection(selection);
}
