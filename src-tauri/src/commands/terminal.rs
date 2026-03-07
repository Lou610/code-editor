use std::collections::HashMap;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, ChildStdin};
use tokio::sync::Mutex;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct TerminalSession {
    pub stdin: ChildStdin,
    pub child: Child,
}

/// Managed state: maps shell process ID → its stdin handle.
pub struct TerminalState {
    pub sessions: Mutex<HashMap<u32, TerminalSession>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolve shell executable + startup flags for the given shell name.
fn shell_args(shell: &str) -> (&str, Vec<&'static str>) {
    let lower = shell.to_lowercase();
    if lower.contains("pwsh") {
        // PowerShell 7+
        ("pwsh", vec!["-NoLogo", "-NoProfile", "-Command", "-"])
    } else if lower.contains("powershell") {
        // Windows PowerShell 5
        (
            "powershell.exe",
            vec!["-NoLogo", "-NoProfile", "-Command", "-"],
        )
    } else if lower.contains("cmd") {
        ("cmd.exe", vec!["/Q", "/K", "prompt $G$S"])
    } else if lower.contains("bash") {
        ("bash", vec!["-i"])
    } else if lower.contains("zsh") {
        ("zsh", vec!["-i"])
    } else {
        (shell.trim(), vec![])
    }
}

/// Spawn a shell process, stream stdout+stderr as `terminal-data` events,
/// and return the process ID so the frontend can route write/kill calls.
#[tauri::command]
pub async fn terminal_create(
    app: AppHandle,
    shell: String,
    cwd: Option<String>,
) -> Result<u32, String> {
    let (exe, args) = shell_args(&shell);

    let mut cmd = tokio::process::Command::new(exe);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        // Prevent a transient external console window when spawning shells.
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn `{exe}`: {e}"))?;

    let pid = child.id().unwrap_or(0);
    let stdin = child.stdin.take().ok_or("could not get stdin")?;
    let stdout = child.stdout.take().ok_or("could not get stdout")?;
    let stderr = child.stderr.take().ok_or("could not get stderr")?;

    // Store stdin so terminal_write can send input.
    app.state::<TerminalState>()
        .sessions
        .lock()
        .await
        .insert(pid, TerminalSession { stdin, child });

    // Background task: stream stdout → frontend events.
    let app_out = app.clone();
    tokio::spawn(async move {
        let mut reader = stdout;
        let mut buf = vec![0u8; 4096];
        loop {
            match reader.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app_out.emit("terminal-data", &text);
                }
            }
        }
        // Notify frontend that the shell has exited.
        let _ = app_out.emit("terminal-exit", ());
    });

    // Background task: stream stderr → same events channel.
    let app_err = app.clone();
    tokio::spawn(async move {
        let mut reader = stderr;
        let mut buf = vec![0u8; 4096];
        loop {
            match reader.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app_err.emit("terminal-data", &text);
                }
            }
        }
    });

    Ok(pid)
}

/// Write raw bytes to the shell's stdin (called for each keystroke / pasted text).
#[tauri::command]
pub async fn terminal_write(app: AppHandle, pid: u32, data: String) -> Result<(), String> {
    let state = app.state::<TerminalState>();
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

/// Kill the shell process and remove the session.
#[tauri::command]
pub async fn terminal_kill(app: AppHandle, pid: u32) -> Result<(), String> {
    let session = app
        .state::<TerminalState>()
        .sessions
        .lock()
        .await
        .remove(&pid);

    if let Some(mut s) = session {
        // Best-effort termination; process may already have exited.
        let _ = s.child.kill().await;
        let _ = s.child.wait().await;
    }

    Ok(())
}
