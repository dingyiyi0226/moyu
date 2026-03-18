use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

// macOS-only: use native NSAlert to display the app icon and avoid repositioning the tray panel.
// rfd / tauri-plugin-dialog falls back to CFUserNotificationDisplayAlert (no custom icon) when
// there is no parent window, and setting a parent would pull the NSPanel to the screen centre.
pub(crate) mod alert {
    use objc2::rc::autoreleasepool;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{
        NSAlert, NSAlertFirstButtonReturn, NSAlertStyle, NSApplication, NSModalResponse,
    };
    use objc2_foundation::NSString;

    fn run_on_main<R: Send, F: FnOnce(MainThreadMarker) -> R + Send>(run: F) -> R {
        if let Some(mtm) = MainThreadMarker::new() {
            run(mtm)
        } else {
            dispatch2::run_on_main(run)
        }
    }

    fn build_alert(
        mtm: MainThreadMarker,
        style: NSAlertStyle,
        title: &str,
        message: &str,
        buttons: &[&str],
    ) -> NSModalResponse {
        let alert = NSAlert::new(mtm);
        alert.setAlertStyle(style);
        alert.setMessageText(&NSString::from_str(title));
        alert.setInformativeText(&NSString::from_str(message));

        let app = NSApplication::sharedApplication(mtm);
        if let Some(icon) = app.applicationIconImage() {
            unsafe { alert.setIcon(Some(&icon)) };
        }

        for label in buttons {
            alert.addButtonWithTitle(&NSString::from_str(label));
        }

        alert.runModal()
    }

    pub fn show_message(title: &str, message: &str) {
        let title = title.to_owned();
        let message = message.to_owned();
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                build_alert(mtm, NSAlertStyle::Informational, &title, &message, &["OK"]);
            });
        });
    }

    pub fn show_confirm(title: &str, message: &str, ok: &str, cancel: &str) -> bool {
        let title = title.to_owned();
        let message = message.to_owned();
        let ok = ok.to_owned();
        let cancel = cancel.to_owned();
        autoreleasepool(move |_| {
            run_on_main(move |mtm| {
                let response = build_alert(
                    mtm,
                    NSAlertStyle::Informational,
                    &title,
                    &message,
                    &[&ok, &cancel],
                );
                response == NSAlertFirstButtonReturn
            })
        })
    }
}

pub fn check_for_update(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                alert::show_message("Update Error", &format!("Updater not available: {}", e));
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => {
                let confirmed = alert::show_confirm(
                    "Update Available",
                    &format!("New version {} is available. Install now?", update.version),
                    "Install",
                    "Later",
                );

                if confirmed {
                    match update.download_and_install(|_, _| {}, || {}).await {
                        Ok(()) => {
                            let restart = alert::show_confirm(
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
                            alert::show_message("Update Error", &format!("Update failed: {}", e));
                        }
                    }
                }
            }
            Ok(None) => {
                alert::show_message("No Updates", "There are currently no updates available.");
            }
            Err(e) => {
                alert::show_message(
                    "Update Error",
                    &format!("Failed to check for updates: {}", e),
                );
            }
        }
    });
}
