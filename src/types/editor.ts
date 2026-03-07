/** Mirror of Rust structs for type-safe Tauri commands */

export interface FileContent {
  path: string;
  content: string;
}

export interface RecentFile {
  path: string;
  label: string;
}

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export type LanguageId =
  | "javascript"
  | "typescript"
  | "python"
  | "rust"
  | "cpp"
  | "c"
  | "csharp"
  | "java"
  | "go"
  | "php"
  | "ruby"
  | "html"
  | "css"
  | "json"
  | "yaml"
  | "toml"
  | "markdown"
  | "sql"
  | "bash"
  | "xml"
  | "plain";

export type LineEnding = "LF" | "CRLF" | "CR";

export interface TabState {
  id: string;
  path: string | null;
  label: string;
  content: string;
  dirty: boolean;
  language: LanguageId;
  scrollPosition?: number;
  encoding: string;
  lineEnding: LineEnding;
}
