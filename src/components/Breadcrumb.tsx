import { useEditorStore } from "../store/editorStore";
import type { TabState } from "../types/editor";

export function Breadcrumb() {
  const { tabs, activeTabId } = useEditorStore();
  const activeTab = tabs.find((t: TabState) => t.id === activeTabId);

  if (!activeTab?.path) return null;

  const parts = activeTab.path.replace(/\\/g, "/").split("/").filter(Boolean);

  return (
    <div
      className="flex items-center px-3 h-7 min-h-7 gap-1 text-xs border-b border-[var(--border-subtle)] overflow-x-auto whitespace-nowrap"
      style={{ background: "var(--bg-raised)", color: "var(--text-muted)" }}
    >
      {parts.map((part: string, i: number) => {
        const isLast = i === parts.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="flex-shrink-0 opacity-50"
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            )}
            <span
              className={
                isLast
                  ? "font-medium text-[var(--text-primary)]"
                  : "hover:text-[var(--text-secondary)] transition-colors"
              }
            >
              {part}
            </span>
          </span>
        );
      })}
    </div>
  );
}
