import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEditorStore } from "../store/editorStore";
import { useSettingsStore } from "../store/settingsStore";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const SENTINEL = "##__PROMPT_READY__##";

function getSentinelCmd(shell: string): string {
  const lower = shell.toLowerCase();
  if (lower.includes("powershell") || lower.includes("pwsh")) {
    return `; Write-Host "${SENTINEL}"`;
  }
  if (lower.includes("cmd")) {
    return ` && echo ${SENTINEL}`;
  }
  return `; echo ${SENTINEL}`;
}

const XTERM_THEME = {
  background: "#0f1117",
  foreground: "#e6edf3",
  cursor: "#58a6ff",
  cursorAccent: "#0f1117",
  selectionBackground: "rgba(56,139,253,0.3)",
  black: "#0f1117",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#e6edf3",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79b8ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

function writePrompt(term: Terminal) {
  term.write("\r\n\x1b[1;34mPS\x1b[0m \x1b[90m>\x1b[0m ");
}

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 224;

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const pidRef = useRef<number | null>(null);
  const lineRef = useRef<string>("");
  const awaitingPromptRef = useRef(false);
  const outputBufRef = useRef<string>("");
  const { terminalOpen, workspaceRoot } = useEditorStore();
  const terminalShell = useSettingsStore((s) => s.terminalShell);
  const [shellError, setShellError] = useState<string | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  const handleResizeDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const onMove = (e2: MouseEvent) => {
      const delta = startY - e2.clientY;
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + delta));
      setHeight(next);
      fitRef.current?.fit();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      fitRef.current?.fit();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Write a line to the shell, appending the sentinel so we know when done.
  const sendLine = useCallback(async (line: string) => {
    if (pidRef.current == null) return;
    awaitingPromptRef.current = true;
    const sentinelCmd = getSentinelCmd(terminalShell);
    const payload = line.trim() ? `${line}${sentinelCmd}\r\n` : `\r\n`;
    try {
      await invoke("terminal_write", { pid: pidRef.current, data: payload });
    } catch (e) {
      termRef.current?.writeln(`\r\n\x1b[31mWrite error: ${e}\x1b[0m`);
    }
  }, [terminalShell]);

  // ── Attach xterm input → line buffer → shell.
  const attachInput = useCallback(
    (term: Terminal) => {
      term.onData((data) => {
        const code = data.charCodeAt(0);

        if (data === "\r" || data === "\n") {
          // Enter — echo newline then send buffered line.
          term.write("\r\n");
          const line = lineRef.current;
          lineRef.current = "";
          sendLine(line);
        } else if (code === 127 || code === 8) {
          // Backspace
          if (lineRef.current.length > 0) {
            lineRef.current = lineRef.current.slice(0, -1);
            term.write("\b \b");
          }
        } else if (code === 3) {
          // Ctrl+C — clear line, write ^C, send empty to shell so it can reset
          term.write("^C");
          lineRef.current = "";
          invoke("terminal_write", { pid: pidRef.current, data: "\x03" }).catch(() => {});
          writePrompt(term);
        } else if (code >= 32) {
          // Printable character — local echo.
          lineRef.current += data;
          term.write(data);
        }
        // Arrow keys / other control sequences are intentionally ignored for
        // the piped (non-PTY) model; a true PTY plugin would handle them.
      });
    },
    [sendLine],
  );

  // ── Boot the terminal: create xterm, spawn shell, wire events.
  const boot = useCallback(async () => {
    if (!containerRef.current) return;

    setShellError(null);
    lineRef.current = "";
    awaitingPromptRef.current = false;
    outputBufRef.current = "";

    const term = new Terminal({
      theme: XTERM_THEME,
      fontFamily: "JetBrains Mono, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    // ── Spawn the shell process.
    let pid: number;
    try {
      pid = await invoke<number>("terminal_create", {
        shell: terminalShell,
        cwd: workspaceRoot ?? undefined,
      });
    } catch (e) {
      setShellError(String(e));
      term.writeln(`\x1b[31mFailed to start shell: ${e}\x1b[0m`);
      window.removeEventListener("resize", onResize);
      return;
    }
    pidRef.current = pid;

    // Show initial prompt immediately.
    writePrompt(term);

    // ── Listen for output streamed from Rust.
    const unlistenData: UnlistenFn = await listen<string>("terminal-data", (event) => {
      const raw = event.payload;
      // Accumulate into output buffer, scan for sentinel.
      outputBufRef.current += raw;

      // Strip sentinel from display, show only real output.
      const sentinelIdx = outputBufRef.current.indexOf(SENTINEL);
      if (sentinelIdx !== -1) {
        const visible = outputBufRef.current.slice(0, sentinelIdx);
        outputBufRef.current = outputBufRef.current.slice(sentinelIdx + SENTINEL.length);
        if (visible) term.write(visible);
        awaitingPromptRef.current = false;
        writePrompt(term);
      } else {
        // No sentinel yet — flush everything up to (len - sentinel.len) chars
        // so we don't display partial sentinels.
        const safe = outputBufRef.current.length - SENTINEL.length;
        if (safe > 0) {
          term.write(outputBufRef.current.slice(0, safe));
          outputBufRef.current = outputBufRef.current.slice(safe);
        }
      }
    });

    const unlistenExit: UnlistenFn = await listen("terminal-exit", () => {
      term.writeln("\r\n\x1b[33m[shell exited]\x1b[0m");
      pidRef.current = null;
    });

    // Attach keyboard input.
    attachInput(term);

    // Cleanup on effect teardown.
    return () => {
      unlistenData();
      unlistenExit();
      window.removeEventListener("resize", onResize);
      if (pidRef.current != null) {
        invoke("terminal_kill", { pid: pidRef.current }).catch(() => {});
        pidRef.current = null;
      }
      term.dispose();
      termRef.current = null;
    };
  }, [workspaceRoot, terminalShell, attachInput]);

  // ── Mount / unmount the terminal whenever the panel opens/closes.
  useEffect(() => {
    if (!terminalOpen) {
      if (pidRef.current != null) {
        invoke("terminal_kill", { pid: pidRef.current }).catch(() => {});
        pidRef.current = null;
      }
      termRef.current?.dispose();
      termRef.current = null;
      return;
    }

    let cleanup: (() => void) | void;
    boot().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [terminalOpen, boot]);

  if (!terminalOpen) return null;

  return (
    <div
      className="flex flex-col border-t border-[var(--border-subtle)]"
      style={{ height, background: "var(--bg-base)", boxShadow: "var(--shadow-md)" }}
    >
      {/* Resize handle */}
      <div
        className="flex items-center justify-center h-1.5 flex-shrink-0 cursor-row-resize group hover:bg-[var(--accent)] transition-colors opacity-40 hover:opacity-100"
        style={{ background: "var(--border-subtle)" }}
        onMouseDown={handleResizeDrag}
        role="separator"
        aria-label="Resize terminal"
      >
        <span className="w-8 h-0.5 rounded-full bg-current opacity-60 group-hover:opacity-100" />
      </div>

      {/* Header bar */}
      <div
        className="flex items-center justify-between h-8 px-3 flex-shrink-0 border-b border-[var(--border-subtle)]"
        style={{ background: "var(--bg-raised)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Terminal
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {terminalShell}
          </span>
        </div>
        {shellError && (
          <span className="text-xs text-red-400 truncate max-w-xs">{shellError}</span>
        )}
        <button
          type="button"
          className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Close terminal (Ctrl+`)"
          onClick={() => useEditorStore.getState().toggleTerminal()}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* xterm container */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  );
}
