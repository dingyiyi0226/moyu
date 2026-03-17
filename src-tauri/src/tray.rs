use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

use crate::updater;

#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;

pub struct BreakTimerConfig {
    per_second_rate: f64,
    completed_today: f64,
    currency_symbol: String,
    break_start_ms: u64,
}

pub struct BreakTimerState {
    config: Option<BreakTimerConfig>,
    generation: u64,
}

impl BreakTimerState {
    pub fn new() -> Self {
        Self {
            config: None,
            generation: 0,
        }
    }
}

fn run_timer(app: AppHandle, state: Arc<Mutex<BreakTimerState>>, gen: u64) {
    loop {
        thread::sleep(Duration::from_secs(1));

        let title = {
            let lock = state.lock().unwrap();
            if lock.generation != gen {
                return;
            }
            let Some(ref config) = lock.config else {
                return;
            };
            let now_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            let elapsed_sec = now_ms.saturating_sub(config.break_start_ms) as f64 / 1000.0;
            let current = elapsed_sec * config.per_second_rate;
            let total = config.completed_today + current;
            format!("{}{:.2}", config.currency_symbol, total)
        };

        if let Some(tray) = app.tray_by_id("moyu-tray") {
            let _ = tray.set_title(Some(&title));
        }
    }
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let update_i = MenuItem::with_id(app, "check_update", "Check for Updates...", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Moyu", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &separator, &update_i, &quit_i])?;

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
            "check_update" => {
                updater::check_for_update(app);
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
pub fn start_break_timer(
    app: AppHandle,
    state: tauri::State<Arc<Mutex<BreakTimerState>>>,
    per_second_rate: f64,
    completed_today: f64,
    currency_symbol: String,
    break_start_ms: u64,
) {
    let mut lock = state.lock().unwrap();
    lock.generation += 1;
    let gen = lock.generation;
    lock.config = Some(BreakTimerConfig {
        per_second_rate,
        completed_today,
        currency_symbol: currency_symbol.clone(),
        break_start_ms,
    });
    drop(lock);

    // Set title immediately (elapsed = 0, so total = completed_today)
    if let Some(tray) = app.tray_by_id("moyu-tray") {
        let _ = tray.set_title(Some(&format!("{}{:.2}", currency_symbol, completed_today)));
    }

    let state_arc = state.inner().clone();
    thread::spawn(move || run_timer(app, state_arc, gen));
}

#[tauri::command]
pub fn stop_break_timer(
    app: AppHandle,
    state: tauri::State<Arc<Mutex<BreakTimerState>>>,
) {
    let mut lock = state.lock().unwrap();
    lock.config = None;
    lock.generation += 1;
    drop(lock);

    if let Some(tray) = app.tray_by_id("moyu-tray") {
        let _ = tray.set_title(Some("Moyu"));
    }
}
