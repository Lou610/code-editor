import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { gutter, GutterMarker } from "@codemirror/view";
import { saveFile } from "../tauri/files";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { go } from "@codemirror/lang-go";
import { StreamLanguage, indentUnit } from "@codemirror/language";
import { StateEffect, StateField } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { csharp } from "@codemirror/legacy-modes/mode/clike";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { showMinimap as minimapExtension } from "@replit/codemirror-minimap";
import { invoke } from "@tauri-apps/api/core";
import type { LanguageId } from "../types/editor";
import { useEditorStore } from "../store/editorStore";
import { useSettingsStore } from "../store/settingsStore";
import { setCurrentEditorView } from "../editorRef";

// ── Git diff gutter ──────────────────────────────────────────────────────────

interface DiffHunk { start: number; lines: number; kind: string; }

const setDiffHunks = StateEffect.define<DiffHunk[]>();

const diffHunksField = StateField.define<Map<number, string>>({
  create: () => new Map(),
  update(map, tr) {
    for (const e of tr.effects) {
      if (e.is(setDiffHunks)) {
        const next = new Map<number, string>();
        for (const h of e.value) {
          for (let l = h.start; l < h.start + h.lines; l++) {
            next.set(l, h.kind);
          }
        }
        return next;
      }
    }
    return map;
  },
});

class DiffMarker extends GutterMarker {
  constructor(readonly color: string) { super(); }
  toDOM() {
    const el = document.createElement("div");
    el.style.cssText = `width:3px;height:100%;background:${this.color};margin-left:1px;border-radius:1px`;
    return el;
  }
}

const addedMarker = new DiffMarker("#3fb950");
const modifiedMarker = new DiffMarker("#d29922");
const deletedMarker = new DiffMarker("#f85149");

const gitGutter = [
  diffHunksField,
  gutter({
    class: "cm-git-gutter",
    lineMarker(view: EditorView, line: { from: number }) {
      const lineNum = view.state.doc.lineAt(line.from).number;
      const kind = view.state.field(diffHunksField).get(lineNum);
      if (!kind) return null;
      if (kind === "added") return addedMarker;
      if (kind === "deleted") return deletedMarker;
      return modifiedMarker;
    },
    initialSpacer: () => new DiffMarker("transparent"),
  }),
];

type LangExt = () =>
  | import("@codemirror/state").Extension
  | import("@codemirror/language").LanguageSupport
  | import("@codemirror/state").Extension[];

const LANG_EXT: Record<LanguageId, LangExt> = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  python: python,
  rust: rust,
  c: () => cpp(),
  cpp: cpp,
  csharp: () => StreamLanguage.define(csharp) as unknown as import("@codemirror/language").LanguageSupport,
  java: java,
  go: go,
  php: php,
  ruby: () => StreamLanguage.define(ruby) as unknown as import("@codemirror/language").LanguageSupport,
  html: html,
  css: css,
  json: json,
  yaml: yaml,
  toml: () => StreamLanguage.define(toml) as unknown as import("@codemirror/language").LanguageSupport,
  markdown: markdown,
  sql: () => sql(),
  bash: () =>
    StreamLanguage.define(shell) as unknown as import("@codemirror/language").LanguageSupport,
  xml: xml,
  plain: () => [],
};

export function EditorPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { tabs, activeTabId, updateTabContent, updateTabScroll, setEditorReady, setCursorPosition } =
    useEditorStore();
  const { fontSize, tabSize, wordWrap, fontLigatures, autoSave, autoSaveDelay, fontFamily, theme, showMinimap } =
    useSettingsStore();
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Recreate the editor when the active tab or any display setting changes.
  useEffect(() => {
    if (!containerRef.current || !activeTab) return;

    const ext = LANG_EXT[activeTab.language]?.() ?? [];
    const extList = Array.isArray(ext) ? ext : [ext];

    const resolvedFont = fontLigatures
      ? `"${fontFamily}", "Consolas", "Courier New", monospace`
      : `"Consolas", "Courier New", monospace`;
    const fontFeatures = fontLigatures ? "normal" : '"liga" 0, "calt" 0';

    const isLight = theme === "light";
    const editorBg = isLight ? "#ffffff" : "var(--bg-base)";
    const gutterBg = isLight ? "#f6f8fa" : "var(--bg-raised)";
    const gutterFg = isLight ? "#6e7781" : "var(--text-muted)";
    const activeLineBg = isLight ? "#f0f4f8" : "var(--bg-overlay)";
    const selectionBg = isLight ? "rgba(9,105,218,0.15)" : "rgba(56,139,253,0.25)";
    const cursorColor = isLight ? "#0969da" : "var(--accent)";

    const extensions = [
      basicSetup,
      ...extList,
      // Git diff gutter
      ...gitGutter,
      // Tab / indent size
      EditorState.tabSize.of(tabSize),
      indentUnit.of(" ".repeat(tabSize)),
      // Word wrap
      ...(wordWrap ? [EditorView.lineWrapping] : []),
      // Appearance theme
      EditorView.theme({
        "&": { height: "100%" },
        "&.cm-editor": {
          fontSize: `${fontSize}px`,
          backgroundColor: editorBg,
        },
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": {
          fontFamily: resolvedFont,
          fontFeatureSettings: fontFeatures,
          padding: "12px 0",
        },
        ".cm-gutters": {
          backgroundColor: gutterBg,
          border: "none",
          color: gutterFg,
        },
        ".cm-activeLineGutter": { backgroundColor: activeLineBg },
        ".cm-activeLine": { backgroundColor: activeLineBg },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
          backgroundColor: selectionBg,
        },
        ".cm-cursor": { borderLeftColor: cursorColor },
      }),
      // Minimap
      ...(showMinimap
        ? [
            minimapExtension.of({
              create: () => {
                const dom = document.createElement("div");
                dom.style.width = "80px";
                dom.style.overflow = "hidden";
                dom.style.flexShrink = "0";
                return { dom };
              },
              displayText: "blocks",
              showOverlay: "mouse-over",
            }),
          ]
        : []),
      // Cursor + content tracking
      EditorView.updateListener.of((v) => {
        if (v.docChanged) {
          const content = v.state.doc.toString();
          updateTabContent(activeTab.id, content);
          if (autoSave) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => saveFile(), autoSaveDelay);
          }
        }
        if (v.selectionSet || v.docChanged) {
          const head = v.state.selection.main.head;
          const lineObj = v.state.doc.lineAt(head);
          setCursorPosition(lineObj.number, head - lineObj.from + 1);
        }
      }),
    ];

    const view = new EditorView({
      doc: activeTab.content,
      extensions,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setCurrentEditorView(view);
    setEditorReady(true);

    // Set initial cursor position.
    const head = view.state.selection.main.head;
    const lineObj = view.state.doc.lineAt(head);
    setCursorPosition(lineObj.number, head - lineObj.from + 1);

    if (activeTab.scrollPosition != null) {
      view.scrollDOM.scrollTop = activeTab.scrollPosition;
    }

    // Load git diff for this file (non-blocking).
    if (activeTab.path) {
      invoke<DiffHunk[]>("git_file_diff", { path: activeTab.path })
        .then((hunks) => {
          if (viewRef.current) {
            viewRef.current.dispatch({ effects: setDiffHunks.of(hunks) });
          }
        })
        .catch(() => {});
    }

    return () => {
      const scroll = view.scrollDOM.scrollTop;
      updateTabScroll(activeTab.id, scroll);
      setCurrentEditorView(null);
      setEditorReady(false);
      setCursorPosition(1, 1);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeTab?.id, fontSize, tabSize, wordWrap, fontLigatures, fontFamily, theme, showMinimap]);

  // Sync external content changes (e.g. another process saved the file).
  useEffect(() => {
    if (!activeTab || !viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    if (current !== activeTab.content) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: activeTab.content },
      });
    }
  }, [activeTab?.content]);

  if (!activeTab) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-center px-6"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="max-w-sm space-y-3">
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Open a file or create a new one to start editing.
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            Use{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] border border-[var(--border-subtle)] font-mono text-[var(--text-secondary)]">
              File → Open
            </kbd>{" "}
            or the toolbar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div ref={containerRef} className="h-full w-full cm-editor-host" />
    </div>
  );
}
