import { useSettingsStore } from "../store/settingsStore";

export interface GroveNote {
  id: string;
  title: string;
  icon: string | null;
  favorite: boolean;
  folderId: string | null;
  updatedAt: string;
  folder: { id: string; name: string } | null;
  tags: { id: string; name: string }[];
}

function getBase() {
  const { groveNotesUrl, groveNotesApiKey } = useSettingsStore.getState();
  if (!groveNotesUrl || !groveNotesApiKey) {
    throw new Error("GroveNotes URL and API key must be configured in Settings → GroveNotes.");
  }
  const base = groveNotesUrl.replace(/\/$/, "");
  return { base, headers: { Authorization: `Bearer ${groveNotesApiKey}`, "Content-Type": "application/json" } };
}

export async function listGroveNotes(): Promise<GroveNote[]> {
  const { base, headers } = getBase();
  const res = await fetch(`${base}/api/v1/code-editor/notes`, { headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to list notes");
  return data.data.notes as GroveNote[];
}

export async function fetchGroveNote(id: string): Promise<{ id: string; title: string; markdown: string; updatedAt: string }> {
  const { base, headers } = getBase();
  const res = await fetch(`${base}/api/v1/code-editor/notes/${id}`, { headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch note");
  return data.data;
}

export async function pushGroveNote(id: string, markdown: string, title?: string): Promise<void> {
  const { base, headers } = getBase();
  const body: Record<string, string> = { markdown };
  if (title) body.title = title;
  const res = await fetch(`${base}/api/v1/code-editor/notes/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to update note");
}
