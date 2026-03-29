use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::Manager;

const ICLOUD_FOLDER: &str = "Moyu";
const STORE_FILE: &str = "moyu-data.json";
const BACKUP_PREFIX: &str = "moyu-data-";
const BACKUP_SUFFIX: &str = ".json";

fn icloud_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("Failed to resolve home directory: {e}"))?;
    let icloud_root = home.join("Library/Mobile Documents/com~apple~CloudDocs");
    if !icloud_root.exists() {
        return Err(format!(
            "iCloud Drive is not available at {}. Please enable iCloud Drive in System Settings.",
            icloud_root.display()
        ));
    }
    Ok(icloud_root.join(ICLOUD_FOLDER))
}

#[tauri::command]
pub fn save_to_icloud(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let source = app_data.join(STORE_FILE);

    if !source.exists() {
        return Err("No data file found to backup".into());
    }

    let dest_dir = icloud_dir(&app)?;
    fs::create_dir_all(&dest_dir).map_err(|e| {
        format!(
            "Failed to create iCloud directory {}: {e}",
            dest_dir.display()
        )
    })?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let filename = format!("{BACKUP_PREFIX}{today}{BACKUP_SUFFIX}");
    let dest = dest_dir.join(&filename);
    fs::copy(&source, &dest).map_err(|e| {
        format!(
            "Failed to copy {} → {}: {e}",
            source.display(),
            dest.display()
        )
    })?;

    Ok(filename)
}

#[tauri::command]
pub fn load_from_icloud(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dest = app_data.join(STORE_FILE);

    let source = icloud_dir(&app)?.join(&filename);

    if !source.exists() {
        return Err(format!("No backup found at {}", source.display()));
    }

    fs::create_dir_all(&app_data).map_err(|e| {
        format!(
            "Failed to create app data directory {}: {e}",
            app_data.display()
        )
    })?;
    fs::copy(&source, &dest).map_err(|e| {
        format!(
            "Failed to copy {} → {}: {e}",
            source.display(),
            dest.display()
        )
    })?;

    Ok(())
}

#[derive(serde::Serialize)]
pub struct BackupEntry {
    pub filename: String,
    pub date: String,
    pub modified_ms: u64,
}

#[tauri::command]
pub fn list_icloud_backups(app: tauri::AppHandle) -> Result<Vec<BackupEntry>, String> {
    let dir = icloud_dir(&app)?;

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read iCloud directory {}: {e}", dir.display()))?;

    let mut backups: Vec<BackupEntry> = entries
        .filter_map(|e| e.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            let date = name
                .strip_prefix(BACKUP_PREFIX)?
                .strip_suffix(BACKUP_SUFFIX)?
                .to_string();
            let meta = entry.metadata().ok()?;
            let modified = meta.modified().ok()?;
            let ms = modified.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64;
            Some(BackupEntry {
                filename: name,
                date,
                modified_ms: ms,
            })
        })
        .collect();

    backups.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(backups)
}
