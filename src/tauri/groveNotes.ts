import { useSettingsStore } from "../store/settingsStore";

export const GROVE_NOTES_BASE_URL = "https://grovenotes.com";

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
  const { groveNotesApiKey } = useSettingsStore.getState();
  if (!groveNotesApiKey) {
    throw new Error("GroveNotes API key must be configured in Settings → GroveNotes.");
  }
  return {
    base: GROVE_NOTES_BASE_URL,
    headers: { Authorization: `Bearer ${groveNotesApiKey}`, "Content-Type": "application/json" },
  };
}

async function groveFetch(path: string, init?: RequestInit): Promise<Response> {
  const { base, headers } = getBase();
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Failed to fetch") {
      throw new Error(
        `Could not reach GroveNotes at ${base}. Check your API key and that ${base} is online.`,
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }
}

export async function listGroveNotes(): Promise<GroveNote[]> {
  const res = await groveFetch("/api/v1/code-editor/notes");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to list notes (${res.status})`);
  if (!data.success) throw new Error(data.error || "Failed to list notes");
  return data.data.notes as GroveNote[];
}

export async function fetchGroveNote(id: string): Promise<{ id: string; title: string; markdown: string; updatedAt: string }> {
  const res = await groveFetch(`/api/v1/code-editor/notes/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to fetch note (${res.status})`);
  if (!data.success) throw new Error(data.error || "Failed to fetch note");
  return data.data;
}

export async function pushGroveNote(id: string, markdown: string, title?: string): Promise<void> {
  const body: Record<string, string> = { markdown };
  if (title) body.title = title;
  const res = await groveFetch(`/api/v1/code-editor/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to update note (${res.status})`);
  if (!data.success) throw new Error(data.error || "Failed to update note");
}
