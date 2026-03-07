import { useRef, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useEditorStore } from "../store/editorStore";
import { saveFile } from "../tauri/files";
import type { TabState } from "../types/editor";

export async function tryCloseTab(tab: TabState, closeTab: (id: string) => void) {
  if (!tab.dirty) {
    closeTab(tab.id);
    return;
  }

  const wantSave = await confirm(`Save changes to "${tab.label}" before closing?`, {
    title: "Unsaved Changes",
    kind: "warning",
    okLabel: "Save",
    cancelLabel: "Don't Save",
  });

  if (wantSave) {
    useEditorStore.getState().setActiveTab(tab.id);
    const saved = await saveFile();
    if (!saved) return;
  }

  closeTab(tab.id);
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useEditorStore();
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragIdRef.current) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, toId: string) => {
    e.preventDefault();
    const fromId = dragIdRef.current;
    if (fromId && fromId !== toId) {
      reorderTabs(fromId, toId);
    }
    dragIdRef.current = null;
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDragOverId(null);
  };

  return (
    <div
      className="flex items-end overflow-x-auto min-h-10 gap-0 px-2 pt-1.5 border-b border-[var(--border-subtle)]"
      style={{ background: "var(--bg-raised)" }}
    >
      {tabs.map((tab: TabState) => {
        const isActive = tab.id === activeTabId;
        const isDragOver = tab.id === dragOverId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            className={`
              group flex items-center gap-2 pl-3 pr-1 py-2 rounded-t-lg cursor-pointer min-w-0 max-w-[200px]
              transition-colors duration-150 select-none
              ${isActive
                ? "bg-[var(--bg-base)] text-[var(--text-primary)] border border-b-0 border-[var(--border-default)] border-b-transparent -mb-px"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"}
              ${isDragOver ? "ring-2 ring-[var(--accent)] ring-inset opacity-75" : ""}
            `}
            style={isActive ? { boxShadow: "0 -1px 0 0 var(--bg-base)" } : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="truncate text-sm font-medium flex-1">{tab.label}</span>

            {tab.dirty && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                style={{ background: "var(--unsaved-dot)" }}
                title="Unsaved changes"
              />
            )}

            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex-shrink-0 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                tryCloseTab(tab, closeTab);
              }}
              aria-label={`Close ${tab.label}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l6 6M10 4l-6 6" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
