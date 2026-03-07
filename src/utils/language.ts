import type { LanguageId } from "../types/editor";

const EXTENSION_MAP: Record<string, LanguageId> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  pyw: "python",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  java: "java",
  go: "go",
  php: "php",
  rb: "ruby",
  html: "html",
  htm: "html",
  css: "css",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  markdown: "markdown",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  xml: "xml",
  plain: "plain",
};

export function detectLanguage(filename: string): LanguageId {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "plain";
}

export type LineEnding = "LF" | "CRLF" | "CR";

/** Detect the dominant line ending in a string. */
export function detectLineEnding(content: string): LineEnding {
  if (content.includes("\r\n")) return "CRLF";
  if (content.includes("\r")) return "CR";
  return "LF";
}

/**
 * Detect file encoding.
 * When Rust reads a file with read_to_string, a UTF-8 BOM (EF BB BF) is
 * decoded as U+FEFF at position 0. UTF-16 files are not decoded at all
 * (they fail read_to_string), so we only distinguish UTF-8 with/without BOM.
 */
export function detectEncoding(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) return "UTF-8 BOM";
  return "UTF-8";
}
