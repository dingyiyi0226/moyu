mod icloud;
mod idle_detection;
mod screen_events;
mod tray;
mod updater;

#[cfg(target_os = "macos")]
mod panel;

use std::sync::{Arc, Mutex};
use tauri::Manager;

#[derive(serde::Serialize, Clone)]
pub(crate) struct BreakStartPayload {
    pub ts: u64,
    pub reason: &'static str,
}

pub(crate) type ClockedIn = Arc<Mutex<bool>>;

#[tauri::command]
fn set_clocked_in(clocked: bool, state: tauri::State<ClockedIn>) {
    *state.lock().unwrap() = clocked;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_nspanel::init())
        .invoke_handler(tauri::generate_handler![
            tray::start_break_timer,
            tray::stop_break_timer,
            idle_detection::set_idle_timeout,
            set_clocked_in,
            icloud::save_to_icloud,
            icloud::load_from_icloud,
            icloud::list_icloud_backups,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::create_tray(app.handle())?;

            #[cfg(target_os = "macos")]
            panel::setup_panel(app.handle());

            let clocked_in: ClockedIn = Arc::new(Mutex::new(false));
            app.manage(clocked_in.clone());

            screen_events::start_listening(app.handle().clone(), clocked_in.clone());

            let timeout_arc: Arc<Mutex<u64>> = Arc::new(Mutex::new(60));
            app.manage(timeout_arc.clone());
            idle_detection::start_idle_detection(app.handle().clone(), timeout_arc, clocked_in);

            let break_timer_state = Arc::new(Mutex::new(tray::BreakTimerState::new()));
            app.manage(break_timer_state);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
