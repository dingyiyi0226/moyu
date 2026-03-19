use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::Manager;

const STORE_FILE: &str = "moyu-data.json";
const ICLOUD_FOLDER: &str = "Moyu";

fn icloud_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let icloud_root = home.join("Library/Mobile Documents/com~apple~CloudDocs");
    if !icloud_root.exists() {
        return Err(
            "iCloud Drive is not available. Please enable iCloud Drive in System Settings.".into(),
        );
    }
    Ok(icloud_root.join(ICLOUD_FOLDER))
}

#[tauri::command]
pub fn save_to_icloud(app: tauri::AppHandle) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let source = app_data.join(STORE_FILE);

    if !source.exists() {
        return Err("No data file found to backup".into());
    }

    let dest_dir = icloud_dir(&app)?;
    fs::create_dir_all(&dest_dir).map_err(|e| format!("Failed to create iCloud directory: {e}"))?;

    let dest = dest_dir.join(STORE_FILE);
    fs::copy(&source, &dest).map_err(|e| format!("Failed to save to iCloud: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn load_from_icloud(app: tauri::AppHandle) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dest = app_data.join(STORE_FILE);

    let source = icloud_dir(&app)?.join(STORE_FILE);

    if !source.exists() {
        return Err("No backup found in iCloud".into());
    }

    fs::create_dir_all(&app_data)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;
    fs::copy(&source, &dest).map_err(|e| format!("Failed to load from iCloud: {e}"))?;

    Ok(())
}

/// Returns the last modified time of the iCloud backup file as Unix ms, or null if none exists.
#[tauri::command]
pub fn get_icloud_backup_time(app: tauri::AppHandle) -> Option<u64> {
    let path = icloud_dir(&app).ok()?.join(STORE_FILE);
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let ms = modified.duration_since(UNIX_EPOCH).ok()?.as_millis();
    Some(ms as u64)
}
