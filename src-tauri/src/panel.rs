#![allow(clippy::unused_unit)]
use tauri::Manager;
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
};

tauri_panel! {
    panel!(MenubarPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true,
        }
    })

    panel_event!(MenubarPanelHandler {
        window_did_resign_key(notification: &NSNotification) -> ()
    })
}

pub fn setup_panel(app: &tauri::AppHandle) {
    let window = app
        .get_webview_window("main")
        .expect("main window not found");

    let panel = window
        .to_panel::<MenubarPanel>()
        .expect("failed to convert to panel");

    // Borderless + non-activating so the panel doesn't steal app focus
    panel.set_style_mask(
        StyleMask::empty()
            .borderless()
            .nonactivating_panel()
            .value(),
    );

    // Float above normal windows at the main-menu level
    panel.set_level(PanelLevel::MainMenu.value());

    // Appear on all spaces, skip Cmd+Tab, work alongside fullscreen apps
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .can_join_all_spaces()
            .transient()
            .ignores_cycle()
            .full_screen_auxiliary()
            .value(),
    );

    panel.set_hides_on_deactivate(false);
    panel.set_corner_radius(12.0);
    panel.set_transparent(true);

    // Auto-hide when the panel loses key-window status (user clicks elsewhere)
    let handler = MenubarPanelHandler::new();
    let app_handle = app.clone();
    handler.window_did_resign_key(move |_| {
        if let Ok(p) = app_handle.get_webview_panel("main") {
            p.hide();
        }
    });
    panel.set_event_handler(Some(handler.as_ref()));
}
