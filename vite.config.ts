import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          const afterNodeModules = id.split("node_modules/")[1] ?? "";
          const segments = afterNodeModules.split("/");
          const pkgName = segments[0]?.startsWith("@")
            ? `${segments[0]}/${segments[1]}`
            : segments[0];

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }
          if (id.includes("@codemirror") || id.includes("codemirror")) {
            return "codemirror-vendor";
          }
          if (id.includes("@xterm") || id.includes("xterm")) {
            return "xterm-vendor";
          }
          if (id.includes("@tauri-apps")) {
            return "tauri-vendor";
          }

          // Split remaining third-party code by package to avoid oversized fallback chunks.
          return `vendor-${pkgName.replace("@", "").replace("/", "-")}`;
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
