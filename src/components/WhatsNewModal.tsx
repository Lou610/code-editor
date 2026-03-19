import { useEditorStore } from "../store/editorStore";

type WhatsNewItem = {
  title: string;
  description: string;
  badge: string;
};

const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    title: "Modernized Settings Experience",
    description:
      "A refreshed settings layout with cleaner grouping, improved spacing, and smoother controls.",
    badge: "UI",
  },
  {
    title: "Integrated Auto-Update Flow",
    description:
      "The app can now check for updates on startup and guide users through install + relaunch.",
    badge: "Productivity",
  },
  {
    title: "Safer App Close Handling",
    description:
      "Unsaved file protection now applies consistently, including OS-level close actions.",
    badge: "Reliability",
  },
  {
    title: "Project Search and Navigation Improvements",
    description:
      "Faster in-project search workflows and streamlined keyboard-driven navigation between tools.",
    badge: "Editor",
  },
];

function FeatureCard({ item }: { item: WhatsNewItem }) {
  return (
    <article
      className="rounded-lg border border-[var(--border-default)] p-4"
      style={{ background: "var(--bg-overlay)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md"
          style={{
            background: "var(--accent-muted)",
            color: "var(--accent)",
          }}
        >
          {item.badge}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
    </article>
  );
}

export function WhatsNewModal() {
  const { whatsNewOpen, toggleWhatsNew } = useEditorStore();

  if (!whatsNewOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={toggleWhatsNew}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="What's New">
        <div
          className="w-full max-w-2xl rounded-xl border border-[var(--border-default)] shadow-2xl flex flex-col max-h-[90vh]"
          style={{ background: "var(--bg-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="px-6 py-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-semibold">
                  GroveNotes
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">What&apos;s New</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Fresh improvements designed to make editing faster, cleaner, and more reliable.
                </p>
              </div>
              <button
                type="button"
                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                onClick={toggleWhatsNew}
                aria-label="Close What's New"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </header>

          <div className="px-6 py-5 overflow-y-auto">
            <div className="grid grid-cols-1 gap-3">
              {WHATS_NEW_ITEMS.map((item) => (
                <FeatureCard key={item.title} item={item} />
              ))}
            </div>
          </div>

          <footer className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end">
            <button
              type="button"
              className="px-4 h-9 rounded-md text-sm font-semibold transition-colors text-white"
              style={{ background: "var(--accent)" }}
              onClick={toggleWhatsNew}
            >
              Awesome
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}
