use std::collections::HashMap;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, ChildStdin};
use tokio::sync::Mutex;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct LspSession {
    pub stdin: ChildStdin,
    pub child: Child,
}

/// Managed state: maps language server process ID -> stdin + child handles.
pub struct LspState {
    pub sessions: Mutex<HashMap<u32, LspSession>>,
}

impl LspState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for LspState {
    fn default() -> Self {
        Self::new()
    }
}

/// Spawn an LSP server process and return its process ID.
///
/// The frontend is responsible for sending/receiving JSON-RPC framing.
#[tauri::command]
pub async fn lsp_start(
    app: AppHandle,
    server: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<u32, String> {
    let mut cmd = tokio::process::Command::new(server.as_str());
    cmd.args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        // Keep language servers hidden when launched from a GUI app.
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn LSP server `{server}`: {e}"))?;

    let pid = child.id().unwrap_or(0);
    let stdin = child.stdin.take().ok_or("could not get lsp stdin")?;
    let stdout = child.stdout.take().ok_or("could not get lsp stdout")?;
    let stderr = child.stderr.take().ok_or("could not get lsp stderr")?;

    app.state::<LspState>()
        .sessions
        .lock()
        .await
        .insert(pid, LspSession { stdin, child });

    let app_out = app.clone();
    tokio::spawn(async move {
        let mut reader = stdout;
        let mut buf = vec![0u8; 8192];
        loop {
            match reader.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let chunk = buf[..n].to_vec();
                    let _ = app_out.emit("lsp-data", (pid, chunk));
                }
            }
        }

        app_out
            .state::<LspState>()
            .sessions
            .lock()
            .await
            .remove(&pid);
        let _ = app_out.emit("lsp-exit", pid);
    });

    let app_err = app.clone();
    tokio::spawn(async move {
        let mut reader = stderr;
        let mut buf = vec![0u8; 4096];
        loop {
            match reader.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app_err.emit("lsp-stderr", (pid, text));
                }
            }
        }
    });

    Ok(pid)
}

/// Send raw JSON-RPC framed bytes to the language server stdin.
#[tauri::command]
pub async fn lsp_send(app: AppHandle, pid: u32, data: String) -> Result<(), String> {
    let state = app.state::<LspState>();
    let mut sessions = state.sessions.lock().await;
    if let Some(session) = sessions.get_mut(&pid) {
        session
            .stdin
            .write_all(data.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        session.stdin.flush().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Kill a language server process and remove it from session state.
#[tauri::command]
pub async fn lsp_stop(app: AppHandle, pid: u32) -> Result<(), String> {
    let session = app
        .state::<LspState>()
        .sessions
        .lock()
        .await
        .remove(&pid);

    if let Some(mut s) = session {
        let _ = s.child.kill().await;
        let _ = s.child.wait().await;
    }

    Ok(())
}
