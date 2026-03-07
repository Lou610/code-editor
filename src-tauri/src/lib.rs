mod commands;

use commands::{
    create_dir, create_file, delete_entry, get_file_mtime, git_branch, git_file_diff, path_exists,
    read_dir, read_file, rename_entry, search_in_files, terminal_create, terminal_kill,
    terminal_write, write_file, TerminalState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            path_exists,
            read_dir,
            create_file,
            create_dir,
            rename_entry,
            delete_entry,
            search_in_files,
            git_branch,
            git_file_diff,
            get_file_mtime,
            terminal_create,
            terminal_write,
            terminal_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
