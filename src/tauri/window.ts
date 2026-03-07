import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useEditorStore } from "../store/editorStore";
import type { TabState } from "../types/editor";

/**
 * Shared close logic used by the custom ✕ button, File → Exit,
 * and the Alt+F4 / taskbar-close guard.
 *
 * Checks for dirty tabs, prompts the user if necessary, then
 * destroys the window. Using destroy() instead of close() avoids
 * re-entering onCloseRequested.
 */
export async function tryCloseApp(): Promise<void> {
  const { tabs } = useEditorStore.getState();
  const dirtyTabs = tabs.filter((t: TabState) => t.dirty);

  if (dirtyTabs.length > 0) {
    const count = dirtyTabs.length;
    const ok = await confirm(
      `You have ${count} unsaved file${count > 1 ? "s" : ""}. Close without saving?`,
      { title: "Unsaved Changes", kind: "warning", okLabel: "Close Anyway", cancelLabel: "Cancel" },
    );
    if (!ok) return;
  }

  // destroy() closes immediately without emitting another close-requested event,
  // which prevents the onCloseRequested handler from looping.
  await getCurrentWindow().destroy();
}
