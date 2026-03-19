## macOS Build & Runtime Findings

### Context
- **App**: GroveNotes (`grovenotes`) — Tauri v2 + React/Vite desktop code editor.
- **Target**: macOS packaged app (bundle built successfully but does not run).
- **Config sources**: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`.

### Build Configuration
- **NPM / Tauri CLI**
  - `package.json` defines `"tauri": "tauri"` script and uses `@tauri-apps/cli` as a dev dependency (`^2`), which is correct for Tauri v2.
  - Local sandbox build failed with `sh: tauri: command not found`, indicating that in this environment the Tauri CLI is not on `PATH` when `npm run tauri` is invoked, but this is an environment issue, not an app code/config problem.
  - Frontend build command is standard: `"build": "tsc && vite build"`.
- **Tauri build section (`tauri.conf.json`)**
  - `beforeBuildCommand`: `"npm run build"` — compiles TypeScript and builds the Vite app.
  - `frontendDist`: `"../dist"` — matches Vite’s default output directory and is consistent with the project layout.
  - `targets`: `"all"` — the Tauri bundler will produce all supported targets for the current OS, including `.app` on macOS.

### App Configuration
- **Bundle identity**
  - `productName`: `"GroveNotes"`, `identifier`: `"com.destroflare.grovenotes"`, `version`: `"1.0.3"` — well‑formed bundle metadata for macOS.
  - Bundle icons include a `.icns` entry (`icons/icon.icns`), which is required for a macOS app bundle.
- **Windows**
  - Single main window configured with a custom, frameless look (`decorations: false`) and reasonable size/minimums.
  - No obviously invalid window options that would prevent startup on macOS.
- **Security / CSP**
  - CSP restricts sources to local/IPC endpoints and static assets; nothing here would itself prevent process startup (it would affect rendering/network, not whether the process launches).

### Rust Side / Entry Point
- **Binary entry (`src-tauri/src/main.rs`)**
  - `main` simply calls `grovenotes_lib::run()`, so the actual runtime is in the library crate.
- **Cargo configuration (`src-tauri/Cargo.toml`)**
  - Package name `grovenotes` and version `1.0.3` align with Tauri config.
  - `lib` name `grovenotes_lib` with `crate-type = ["staticlib", "cdylib", "rlib"]` is set up specifically to keep the lib name distinct from the bin, which is important on Windows but also fine on macOS.
  - Dependencies use `tauri = "2"` and the v2 plugin ecosystem (`tauri-plugin-opener`, `fs`, `dialog`, `process`, `updater`), which matches the TypeScript side’s `@tauri-apps/api` and Tauri plugins.

### Observed / Likely Root Causes (macOS app builds but won’t run)
Because the macOS bundle builds successfully and no obvious misconfiguration appears in `tauri.conf.json` or `Cargo.toml`, the most probable causes are external/runtime issues rather than compile‑time ones:

### Recommended Next Steps to Pinpoint the Exact Reason
- **Run the built app from a terminal on macOS**
  - Navigate into the `.app` bundle’s executable (e.g., `GroveNotes.app/Contents/MacOS/GroveNotes`) and run it directly from `Terminal`.
  - Capture any stdout/stderr or Rust backtraces; if there is a panic, it will print there and directly implicate `grovenotes_lib::run()` or a plugin.
- **Check macOS security warnings explicitly**
  - Try opening the app via Finder; then open `System Settings → Privacy & Security` and look for a message about GroveNotes being blocked, with an “Open Anyway” button.
  - If present, the immediate fix is to allow the app; the long‑term fix is to configure proper signing/notarization when distributing.
- **Inspect Rust library implementation**
  - Review `src-tauri/src/lib.rs` and any modules used by `grovenotes_lib::run()` for:
    - Panics (`panic!`, `unwrap`, `expect`) on startup.
    - Assumptions about environment variables, paths, or resources that might not hold in a packaged macOS bundle.
- **Gather logs from `Console.app`**
  - Filter by `GroveNotes` or `com.destroflare.grovenotes` around the time you launch the app to see whether macOS is blocking it or it is crashing on its own.

### Summary
- **What we know**: The Tauri + React/Vite configuration and bundle metadata look structurally correct; the sandbox environment here lacks the Tauri CLI, but your actual machine does not (since you’re getting a build). The likely root causes for “build succeeds but app doesn’t run” are macOS security/signed‑app restrictions or a runtime crash within `grovenotes_lib::run()` or its dependencies.
- **What to confirm**: Exact behavior and error output when launching from Terminal and logs from `Console.app`; whether macOS is blocking the app for security reasons; and whether `grovenotes_lib::run()` contains panics or assumptions that fail only in a packaged macOS environment.
