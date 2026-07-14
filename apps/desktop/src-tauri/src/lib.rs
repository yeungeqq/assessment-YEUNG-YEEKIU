use std::fs;
use std::path::{Path, PathBuf};

fn sanitize_filename(filename: &str) -> String {
    let sanitized: String = filename
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect();

    let trimmed = sanitized.trim().trim_start_matches('.').to_string();
    if trimmed.is_empty() {
        "document".to_string()
    } else {
        trimmed
    }
}

fn downloads_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Could not find the home directory.".to_string())?;
    Ok(home.join("Downloads"))
}

fn unique_path(directory: &Path, filename: &str) -> PathBuf {
    let candidate = directory.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let extension = path.extension().and_then(|value| value.to_str());

    for index in 1.. {
        let next_filename = match extension {
            Some(extension) if !extension.is_empty() => {
                format!("{stem} ({index}).{extension}")
            }
            _ => format!("{stem} ({index})"),
        };
        let next = directory.join(next_filename);
        if !next.exists() {
            return next;
        }
    }

    candidate
}

#[tauri::command]
fn save_file_to_downloads(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    let directory = downloads_dir()?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create Downloads directory: {error}"))?;

    let path = unique_path(&directory, &sanitize_filename(&filename));
    fs::write(&path, bytes).map_err(|error| format!("Could not save file: {error}"))?;

    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_file_to_downloads])
        .run(tauri::generate_context!())
        .expect("error while running CortexDocs AI desktop app");
}
