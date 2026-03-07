# GroveNotes

[![Release](https://github.com/Lou610/code-editor/actions/workflows/release.yml/badge.svg)](https://github.com/Lou610/code-editor/actions/workflows/release.yml)
[![CI](https://github.com/Lou610/code-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/Lou610/code-editor/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/Lou610/code-editor?display_name=tag)](https://github.com/Lou610/code-editor/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

GroveNotes is a desktop code editor built with Tauri v2 (Rust backend) and React + TypeScript (Vite frontend). It is designed to feel fast, lightweight, and native while still supporting modern editing workflows.

## Screenshots

Add screenshots to `public/assets/images/` and link them below.

Example layout:

```md
![Editor](public/assets/images/editor-main.png)
![Terminal](public/assets/images/terminal-panel.png)
![Settings](public/assets/images/settings-themes.png)
```

## Highlights

- CodeMirror 6 editor with broad language support (JS/TS, Python, Rust, C/C++, Java, Go, PHP, HTML, CSS, JSON, YAML, Markdown, SQL, Bash, XML, and more)
- Multi-tab editing with dirty-state tracking
- File explorer, recent files, and workspace support
- Find/replace, project search, and go-to-line
- Integrated terminal panel (xterm.js)
- Git branch and file diff indicators
- Built-in auto-updater via GitHub Releases (`latest.json`)
- Multiple UI themes: `dark`, `light`, `ocean`, `forest`, `sunset`

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Zustand, CodeMirror, xterm.js
- Backend: Rust, Tauri v2, Tokio
- CI/CD: GitHub Actions + `tauri-apps/tauri-action`

## Prerequisites

- Node.js 20+ and npm
- Rust toolchain (recommended: `rustup`)
- Windows build tools for Rust:
	- Visual Studio Build Tools
	- "Desktop development with C++" workload

If you hit `linker 'link.exe' not found`, install/update Visual Studio Build Tools and ensure the C++ workload is selected.

## Quick Start

```bash
npm install
npm run tauri dev
```

If `cargo` is not found in your terminal session (common right after a fresh Rust install), reopen your terminal or run:

```powershell
.\scripts\dev.ps1
```

That script temporarily appends `%USERPROFILE%\.cargo\bin` to `PATH` and starts `tauri dev`.

## Build

```bash
npm run build
npm run tauri build
```

Build output is generated under `src-tauri/target/release/`.

## NPM Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Frontend dev server only (Vite) |
| `npm run build` | Type-check and build frontend |
| `npm run preview` | Preview built frontend |
| `npm run tauri dev` | Run the desktop app in development |
| `npm run tauri build` | Build desktop app bundles |

## Auto Update Flow

GroveNotes is configured to check for updates on startup using Tauri Updater.

- Update endpoint: `https://github.com/Lou610/code-editor/releases/latest/download/latest.json`
- Signed artifacts are generated during release builds
- On update found: user is prompted to install, then app relaunches

To publish an update:

1. Bump app versions (`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`)
2. Push to `main`
3. Create and push a release tag (for example `V0.0.4`)
4. GitHub Actions release workflow builds and publishes installers + updater metadata

## Release Workflow

Tag pushes (`v*` or `V*`) trigger `.github/workflows/release.yml`, which:

- installs Node and Rust toolchains
- runs Tauri release build on Windows
- uploads release assets
- uploads updater metadata/signatures (`latest.json` + `.sig`)

Required GitHub secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Project Layout

```text
code-editor/
|- src/                  # React frontend
|  |- components/        # UI components (editor, terminal, sidebar, settings)
|  |- store/             # Zustand stores
|  |- tauri/             # Frontend wrappers for Tauri APIs
|  |- types/             # Shared TS types
|  `- utils/             # Utility helpers
|- src-tauri/            # Rust backend (Tauri)
|  |- src/commands/      # Tauri command handlers (files, search, terminal, git)
|  |- capabilities/      # Permission manifests
|  `- tauri.conf.json    # Tauri app and updater configuration
`- .github/workflows/    # CI and release pipelines
```

## Development Notes

- Format/lint frontend: `npx eslint src`
- Format backend: `cargo fmt`
- Validate backend quickly: `cargo check` (run from `src-tauri`)

## License

MIT
