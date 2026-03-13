use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Moyu", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let _tray = TrayIconBuilder::with_id("moyu-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .icon_as_template(true)
        .title("Moyu")
        .tooltip("Moyu - Salary Tracker")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                #[cfg(target_os = "macos")]
                {
                    if let Ok(panel) = app.get_webview_panel("main") {
                        panel.show_and_make_key();
                    }
                }
                #[cfg(not(target_os = "macos"))]
                {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                let app = tray.app_handle();

                #[cfg(target_os = "macos")]
                {
                    if let Ok(panel) = app.get_webview_panel("main") {
                        if panel.is_visible() {
                            panel.hide();
                        } else {
                            // Position window centered below the tray icon
                            if let Some(window) = app.get_webview_window("main") {
                                if let Ok(win_size) = window.outer_size() {
                                    let scale = window.scale_factor().unwrap_or(1.0);
                                    let icon_pos = rect.position.to_logical::<f64>(scale);
                                    let icon_size = rect.size.to_logical::<f64>(scale);
                                    let win_w = win_size.width as f64 / scale;

                                    let x = icon_pos.x + (icon_size.width / 2.0)
                                        - (win_w / 2.0);
                                    let y = icon_pos.y + icon_size.height;
                                    let _ = window.set_position(
                                        tauri::LogicalPosition::new(x, y),
                                    );
                                }
                            }
                            panel.show_and_make_key();
                        }
                    }
                }

                #[cfg(not(target_os = "macos"))]
                {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            if let Ok(win_size) = window.outer_size() {
                                let scale = window.scale_factor().unwrap_or(1.0);
                                let icon_pos = rect.position.to_logical::<f64>(scale);
                                let icon_size = rect.size.to_logical::<f64>(scale);
                                let win_w = win_size.width as f64 / scale;

                                let x = icon_pos.x + (icon_size.width / 2.0)
                                    - (win_w / 2.0);
                                let y = icon_pos.y + icon_size.height;
                                let _ = window.set_position(
                                    tauri::LogicalPosition::new(x, y),
                                );
                            }
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
pub fn update_tray_title(app: AppHandle, title: String) {
    if let Some(tray) = app.tray_by_id("moyu-tray") {
        let _ = tray.set_title(if title.is_empty() {
            None
        } else {
            Some(&title)
        });
    }
}
