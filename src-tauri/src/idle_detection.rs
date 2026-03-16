use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize, Clone)]
struct BreakStartPayload {
    ts: u64,
    reason: &'static str,
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state_id: i32, event_type: u32) -> f64;
}

// kCGEventSourceStateCombinedSessionState = 0, kCGAnyInputEventType = u32::MAX
#[cfg(target_os = "macos")]
fn seconds_since_last_input() -> f64 {
    unsafe { CGEventSourceSecondsSinceLastEventType(0, u32::MAX) }
}

pub fn start_idle_detection(app: AppHandle, timeout_secs: Arc<Mutex<u64>>) {
    #[cfg(target_os = "macos")]
    thread::spawn(move || {
        let mut was_idle = false;
        loop {
            thread::sleep(Duration::from_secs(1));
            let threshold = *timeout_secs.lock().unwrap() as f64;
            let idle = seconds_since_last_input();

            if !was_idle && idle >= threshold {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let ts = now_ms - (idle * 1000.0) as u64;
                let _ = app.emit("break:started", BreakStartPayload { ts, reason: "idle" });
                was_idle = true;
            } else if was_idle && idle < 1.0 {
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let _ = app.emit("break:ended", ts);
                was_idle = false;
            }
        }
    });
}

#[tauri::command]
pub fn set_idle_timeout(seconds: u64, timeout_secs: tauri::State<Arc<Mutex<u64>>>) {
    println!("[IdleDetection] Idle timeout changed to {}s", seconds);
    *timeout_secs.lock().unwrap() = seconds;
}
