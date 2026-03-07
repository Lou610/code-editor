use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub label: String,
}

/// Read a text file from the given path (invoked from frontend with path from dialog).
#[tauri::command]
pub async fn read_file(path: PathBuf) -> Result<FileContent, String> {
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    let content = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    Ok(FileContent {
        path: path.to_string_lossy().into_owned(),
        content,
    })
}

/// Write content to a path (for save).
#[tauri::command]
pub async fn write_file(path: PathBuf, content: String) -> Result<(), String> {
    tokio::fs::write(path, content).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Check if path exists.
#[tauri::command]
pub async fn path_exists(path: PathBuf) -> Result<bool, String> {
    Ok(path.exists())
}

/// Create a new empty file at the given path.
#[tauri::command]
pub async fn create_file(path: PathBuf) -> Result<(), String> {
    tokio::fs::write(&path, "").await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a new directory (and any missing parents) at the given path.
#[tauri::command]
pub async fn create_dir(path: PathBuf) -> Result<(), String> {
    tokio::fs::create_dir_all(&path).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Rename/move a file or directory.
#[tauri::command]
pub async fn rename_entry(old_path: PathBuf, new_path: PathBuf) -> Result<(), String> {
    tokio::fs::rename(old_path, new_path).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a file or directory (directory is removed recursively).
#[tauri::command]
pub async fn delete_entry(path: PathBuf) -> Result<(), String> {
    if path.is_dir() {
        tokio::fs::remove_dir_all(&path).await.map_err(|e| e.to_string())?;
    } else {
        tokio::fs::remove_file(&path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// List directory contents (for file explorer).
#[tauri::command]
pub async fn read_dir(path: PathBuf) -> Result<Vec<DirEntry>, String> {
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    let mut read = tokio::fs::read_dir(&path).await.map_err(|e| e.to_string())?;
    while let Some(entry) = read.next_entry().await.map_err(|e| e.to_string())? {
        let name = entry
            .file_name()
            .to_string_lossy()
            .into_owned();
        let path_buf = entry.path();
        let path_str = path_buf.to_string_lossy().into_owned();
        let is_dir = entry.file_type().await.map_err(|e| e.to_string())?.is_dir();
        entries.push(DirEntry {
            name,
            path: path_str,
            is_dir,
        });
    }
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    Ok(entries)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: usize,
    pub line_content: String,
}

const MAX_SEARCH_RESULTS: usize = 500;

/// Recursively search for a text query across all readable files under `root`.
#[tauri::command]
pub async fn search_in_files(
    root: PathBuf,
    query: String,
    case_sensitive: bool,
) -> Result<Vec<SearchMatch>, String> {
    let mut results = Vec::new();
    search_dir(&root, &query, case_sensitive, &mut results).await?;
    Ok(results)
}

fn search_dir<'a>(
    dir: &'a PathBuf,
    query: &'a str,
    case_sensitive: bool,
    results: &'a mut Vec<SearchMatch>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send + 'a>> {
    Box::pin(async move {
        let mut read = match tokio::fs::read_dir(dir).await {
            Ok(r) => r,
            Err(_) => return Ok(()),
        };
        while let Some(entry) = read.next_entry().await.map_err(|e| e.to_string())? {
            if results.len() >= MAX_SEARCH_RESULTS {
                break;
            }
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            if path.is_dir() {
                let skip = matches!(
                    name.as_str(),
                    "node_modules" | "target" | ".git" | "dist" | "build" | ".next" | "out"
                );
                if !skip {
                    search_dir(&path, query, case_sensitive, results).await?;
                }
            } else {
                let Ok(content) = tokio::fs::read_to_string(&path).await else {
                    continue;
                };
                let needle = if case_sensitive {
                    query.to_string()
                } else {
                    query.to_lowercase()
                };
                for (i, line) in content.lines().enumerate() {
                    if results.len() >= MAX_SEARCH_RESULTS {
                        break;
                    }
                    let haystack = if case_sensitive {
                        line.to_string()
                    } else {
                        line.to_lowercase()
                    };
                    if haystack.contains(&needle) {
                        results.push(SearchMatch {
                            path: path.to_string_lossy().into_owned(),
                            line: i + 1,
                            line_content: line.trim_end().to_string(),
                        });
                    }
                }
            }
        }
        Ok(())
    })
}

/// Return the current git branch for the given directory, or empty string if not a git repo.
#[tauri::command]
pub async fn git_branch(root: String) -> String {
    let output = tokio::process::Command::new("git")
        .args(["-C", &root, "rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .await;
    match output {
        Ok(o) if o.status.success() => {
            String::from_utf8_lossy(&o.stdout).trim().to_string()
        }
        _ => String::new(),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffHunk {
    /// Line number where the hunk starts in the *new* file (1-indexed).
    pub start: usize,
    /// Number of lines in this hunk in the new file.
    pub lines: usize,
    /// "added" | "modified" | "context"
    pub kind: String,
}

/// Return git diff hunks for a single file (compared to HEAD).
/// Returns an empty vec if the file is untracked, binary, or not in a git repo.
#[tauri::command]
pub async fn git_file_diff(path: String) -> Vec<DiffHunk> {
    let pb = PathBuf::from(&path);
    let dir = match pb.parent() {
        Some(d) => d.to_string_lossy().to_string(),
        None => return vec![],
    };

    // `git diff HEAD -- <file>` for committed files; fall back to `git diff --cached` for staged
    let raw = tokio::process::Command::new("git")
        .args(["-C", &dir, "diff", "HEAD", "--unified=0", "--", &path])
        .output()
        .await;

    let text = match raw {
        Ok(o) if !o.stdout.is_empty() => String::from_utf8_lossy(&o.stdout).into_owned(),
        _ => {
            // Try comparing against the empty tree (new/untracked file added to index)
            let raw2 = tokio::process::Command::new("git")
                .args(["-C", &dir, "diff", "--cached", "--unified=0", "--", &path])
                .output()
                .await;
            match raw2 {
                Ok(o) if !o.stdout.is_empty() => String::from_utf8_lossy(&o.stdout).into_owned(),
                _ => return vec![],
            }
        }
    };

    parse_diff_hunks(&text)
}

fn parse_diff_hunks(diff: &str) -> Vec<DiffHunk> {
    let mut hunks = Vec::new();
    // Parse unified diff @@ -a,b +c,d @@ headers
    for line in diff.lines() {
        if let Some(rest) = line.strip_prefix("@@ ") {
            // Find "+c,d" part
            if let Some(plus_pos) = rest.find('+') {
                let after = &rest[plus_pos + 1..];
                let end = after.find(|c: char| c == ' ' || c == '@').unwrap_or(after.len());
                let range = &after[..end];
                let (start, count) = if let Some((s, c)) = range.split_once(',') {
                    (s.parse::<usize>().unwrap_or(0), c.parse::<usize>().unwrap_or(0))
                } else {
                    (range.parse::<usize>().unwrap_or(0), 1)
                };
                if start > 0 && count > 0 {
                    hunks.push(DiffHunk {
                        start,
                        lines: count,
                        kind: "modified".to_string(),
                    });
                }
            }
        }
    }
    hunks
}

/// Return the modification time (Unix ms) of a file, or 0 on error.
#[tauri::command]
pub async fn get_file_mtime(path: String) -> u64 {
    let meta = tokio::fs::metadata(&path).await;
    match meta {
        Ok(m) => m
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        Err(_) => 0,
    }
}
