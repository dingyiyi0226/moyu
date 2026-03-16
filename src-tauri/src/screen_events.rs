#[cfg(target_os = "macos")]
mod macos {
    use core_foundation::base::TCFType;
    use core_foundation::string::CFString;
    use core_foundation_sys::notification_center::*;
    use std::os::raw::c_void;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tauri::{AppHandle, Emitter};

    #[derive(serde::Serialize, Clone)]
    pub struct BreakStartPayload {
        pub ts: u64,
        pub reason: &'static str,
    }

    extern "C" fn callback(
        _center: CFNotificationCenterRef,
        observer: *mut c_void,
        name: CFNotificationName,
        _object: *const c_void,
        _user_info: core_foundation_sys::dictionary::CFDictionaryRef,
    ) {
        let app_handle = unsafe { &*(observer as *const AppHandle) };
        let cf_name = unsafe { CFString::wrap_under_get_rule(name) };
        let name_str = cf_name.to_string();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        if name_str == "com.apple.screenIsLocked" {
            println!("[moyu] Screen locked — break started");
            let _ = app_handle.emit("break:started", BreakStartPayload { ts: timestamp, reason: "screen-lock" });
        } else if name_str == "com.apple.screenIsUnlocked" {
            println!("[moyu] Screen unlocked — break ended");
            let _ = app_handle.emit("break:ended", timestamp);
        }
    }

    pub fn start_listening(app_handle: AppHandle) {
        // Leak the AppHandle so we can use it from the C callback for the app's lifetime
        let app_ptr = Box::into_raw(Box::new(app_handle)) as *const c_void;

        unsafe {
            let center = CFNotificationCenterGetDistributedCenter();

            let lock_name = CFString::new("com.apple.screenIsLocked");
            CFNotificationCenterAddObserver(
                center,
                app_ptr,
                callback,
                lock_name.as_concrete_TypeRef(),
                std::ptr::null(),
                CFNotificationSuspensionBehaviorDeliverImmediately,
            );

            let unlock_name = CFString::new("com.apple.screenIsUnlocked");
            CFNotificationCenterAddObserver(
                center,
                app_ptr,
                callback,
                unlock_name.as_concrete_TypeRef(),
                std::ptr::null(),
                CFNotificationSuspensionBehaviorDeliverImmediately,
            );
        }

        println!("[moyu] Listening for screen lock/unlock events");
    }
}

#[cfg(target_os = "macos")]
pub use macos::start_listening;

#[cfg(not(target_os = "macos"))]
pub fn start_listening(_app_handle: tauri::AppHandle) {
    // No-op on non-macOS platforms
}
