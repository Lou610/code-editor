import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirm, message } from "@tauri-apps/plugin-dialog";

interface CheckForUpdatesOptions {
  interactive?: boolean;
}

/**
 * Checks for a new release and installs it after user confirmation.
 * When `interactive` is false, errors and "up-to-date" states are silent.
 */
export async function checkForUpdates(
  options: CheckForUpdatesOptions = {},
): Promise<boolean> {
  const { interactive = false } = options;

  try {
    const update = await check();

    if (!update) {
      if (interactive) {
        await message("You're already on the latest version.", {
          title: "No Updates",
          kind: "info",
        });
      }
      return false;
    }

    const details = update.body
      ? `Version ${update.version} is available.\n\n${update.body}`
      : `Version ${update.version} is available. Download and install now?`;

    const shouldInstall = await confirm(details, {
      title: "Update Available",
      kind: "info",
      okLabel: "Install",
      cancelLabel: "Later",
    });

    if (!shouldInstall) return false;

    await update.downloadAndInstall();
    await message("Update installed. The app will now restart.", {
      title: "Update Ready",
      kind: "info",
    });
    await relaunch();

    return true;
  } catch (error) {
    console.error("Updater check failed", error);
    if (interactive) {
      await message(`Failed to check for updates.\n\n${String(error)}`, {
        title: "Update Error",
        kind: "warning",
      });
    }
    return false;
  }
}
