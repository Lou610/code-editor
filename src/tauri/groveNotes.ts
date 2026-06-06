import { invoke } from "@tauri-apps/api/core";
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

interface GroveNotesRawResponse {
  status: number;
  body: string;
}

interface GroveApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

function getApiKey(): string {
  const { groveNotesApiKey } = useSettingsStore.getState();
  if (!groveNotesApiKey.trim()) {
    throw new Error("GroveNotes API key must be configured in Settings → GroveNotes.");
  }
  return groveNotesApiKey.trim();
}

function parseApiBody(body: string, status: number): GroveApiResponse {
  const trimmed = body.trimStart();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error(
      "GroveNotes returned a web page instead of API data. The code-editor API may not be live yet on grovenotes.com.",
    );
  }

  try {
    return JSON.parse(body) as GroveApiResponse;
  } catch {
    throw new Error(`Invalid response from GroveNotes (HTTP ${status}).`);
  }
}

async function groveFetch(
  path: string,
  init?: { method?: string; body?: string },
): Promise<{ status: number; data: GroveApiResponse }> {
  const raw = await invoke<GroveNotesRawResponse>("grove_notes_request", {
    apiKey: getApiKey(),
    path,
    method: init?.method ?? null,
    body: init?.body ?? null,
  });

  return {
    status: raw.status,
    data: parseApiBody(raw.body, raw.status),
  };
}

export async function listGroveNotes(): Promise<GroveNote[]> {
  const { status, data } = await groveFetch("/api/v1/code-editor/notes");
  if (!status || status >= 400) {
    throw new Error(data.error || `Failed to list notes (${status})`);
  }
  if (!data.success) throw new Error(data.error || "Failed to list notes");
  return (data.data as { notes: GroveNote[] }).notes;
}

export async function fetchGroveNote(
  id: string,
): Promise<{ id: string; title: string; markdown: string; updatedAt: string }> {
  const { status, data } = await groveFetch(`/api/v1/code-editor/notes/${id}`);
  if (!status || status >= 400) {
    throw new Error(data.error || `Failed to fetch note (${status})`);
  }
  if (!data.success) throw new Error(data.error || "Failed to fetch note");
  return data.data as { id: string; title: string; markdown: string; updatedAt: string };
}

export async function pushGroveNote(id: string, markdown: string, title?: string): Promise<void> {
  const body: Record<string, string> = { markdown };
  if (title) body.title = title;
  const { status, data } = await groveFetch(`/api/v1/code-editor/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!status || status >= 400) {
    throw new Error(data.error || `Failed to update note (${status})`);
  }
  if (!data.success) throw new Error(data.error || "Failed to update note");
}
