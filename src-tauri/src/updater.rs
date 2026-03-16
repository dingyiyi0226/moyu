use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

fn show_message(app: &AppHandle, kind: MessageDialogKind, title: &str, message: &str) {
    app.dialog()
        .message(message)
        .title(title)
        .kind(kind)
        .blocking_show();
}

fn show_confirm(app: &AppHandle, title: &str, message: &str, ok: &str, cancel: &str) -> bool {
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            ok.into(),
            cancel.into(),
        ))
        .blocking_show()
}

pub fn check_for_update(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                show_message(&app, MessageDialogKind::Warning, "Update Error", &format!("Updater not available: {}", e));
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => {
                let confirmed = show_confirm(
                    &app,
                    "Update Available",
                    &format!(
                        "New version {} is available. Install now?",
                        update.version
                    ),
                    "Install",
                    "Later",
                );

                if confirmed {
                    match update.download_and_install(|_, _| {}, || {}).await {
                        Ok(()) => {
                            let restart = show_confirm(
                                &app,
                                "Update Complete",
                                "Update installed successfully. Restart now?",
                                "Restart",
                                "Later",
                            );
                            if restart {
                                app.restart();
                            }
                        }
                        Err(e) => {
                            show_message(
                                &app,
                                MessageDialogKind::Warning,
                                "Update Error",
                                &format!("Update failed: {}", e),
                            );
                        }
                    }
                }
            }
            Ok(None) => {
                show_message(
                    &app,
                    MessageDialogKind::Info,
                    "No Updates",
                    "There are currently no updates available.",
                );
            }
            Err(e) => {
                show_message(
                    &app,
                    MessageDialogKind::Warning,
                    "Update Error",
                    &format!("Failed to check for updates: {}", e),
                );
            }
        }
    });
}
