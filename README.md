# Code Editor

A cross-platform code editor built with **Tauri v2** (Rust backend) and **React + TypeScript** (Vite) with **Tailwind CSS**. Lightweight alternative to Notepad++ with support for many programming languages.

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** (install from [rustup](https://rustup.rs/) or `winget install Rustlang.Rustup`)
- **Windows**: **Visual Studio Build Tools** with the **Desktop development with C++** workload (required for Rust). If you see `linker 'link.exe' not found`, install from [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and select "Desktop development with C++".

## Quick Start

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run tauri dev
```

If you see `program not found` for cargo (e.g. terminal was opened before installing Rust), either **reopen the terminal** or run from the project root:

```powershell
.\scripts\dev.ps1
```

That script adds `%USERPROFILE%\.cargo\bin` to PATH for the session, then runs `tauri dev`.

```

## Build for production

```bash
npm run build
npm run tauri build
```

Outputs are in `src-tauri/target/release/` (or `debug/` for dev).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Frontend only (Vite) |
| `npm run build` | Build frontend (TypeScript + Vite) |
| `npm run tauri dev` | Run app in development |
| `npm run tauri build` | Build production binary |

## Features

- **Editor**: CodeMirror 6 with syntax highlighting for JavaScript, TypeScript, Python, Rust, C/C++, Java, Go, PHP, HTML, CSS, JSON, YAML, Markdown, SQL, Bash, and more
- **UI**: Dark theme (VS Code–style), menu bar, resizable sidebar, tabbed editor, status bar
- **Files**: Open, Save, Save As via Tauri commands and system dialogs
- **Shortcuts**: Ctrl+S Save, Ctrl+W Close tab, Ctrl+Tab Cycle tabs, Ctrl+` Terminal, Ctrl+H Find & Replace
- **Find & Replace**: Panel with regex, case-sensitive, whole-word options
- **Terminal**: xterm.js panel (toggle with Ctrl+`)

## Project Structure

```
code-editor/
├── src/                 # Frontend (React + Vite)
│   ├── components/      # MenuBar, Sidebar, TabBar, EditorPane, StatusBar, etc.
│   ├── store/           # Zustand editor state
│   ├── tauri/           # Tauri API wrappers (files, dialogs)
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Helpers (e.g. language detection)
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # read_file, write_file, path_exists
│   │   └── lib.rs       # Tauri app entry and plugin registration
│   └── capabilities/    # Permissions (fs, dialog, etc.)
└── package.json / Cargo.toml
```

## Code Quality

- **ESLint** + **Prettier** for frontend
- **Rust fmt** (`rustfmt.toml`) for backend
- Run `npx eslint src` and `cargo fmt` before committing

## License

MIT
