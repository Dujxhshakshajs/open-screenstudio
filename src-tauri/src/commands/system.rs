//! System-related Tauri commands
//!
//! These commands provide system information like displays, audio devices, etc.

use serde::{Deserialize, Serialize};

/// Display information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
    pub refresh_rate: Option<u32>,
}

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
}

/// Get basic system information
#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        os_version: get_os_version(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

/// Get available displays
#[tauri::command]
pub async fn get_displays() -> Result<Vec<DisplayInfo>, String> {
    // This will be implemented with platform-specific code
    // For now, return a mock display
    #[cfg(target_os = "macos")]
    {
        get_displays_macos()
    }
    
    #[cfg(target_os = "windows")]
    {
        get_displays_windows()
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(vec![DisplayInfo {
            id: 1,
            name: "Main Display".to_string(),
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
            is_primary: true,
            refresh_rate: Some(60),
        }])
    }
}

#[cfg(target_os = "macos")]
fn get_displays_macos() -> Result<Vec<DisplayInfo>, String> {
    use core_graphics::display::CGDisplay;
    
    let displays = CGDisplay::active_displays()
        .map_err(|e| format!("Failed to get displays: {:?}", e))?;
    
    let mut display_infos = Vec::new();
    
    for (index, display_id) in displays.iter().enumerate() {
        let display = CGDisplay::new(*display_id);
        let bounds = display.bounds();
        let is_main = display.is_main();
        
        display_infos.push(DisplayInfo {
            id: *display_id,
            name: if is_main {
                "Main Display".to_string()
            } else {
                format!("Display {}", index + 1)
            },
            width: bounds.size.width as u32,
            height: bounds.size.height as u32,
            scale_factor: display.pixels_high() as f64 / bounds.size.height,
            is_primary: is_main,
            refresh_rate: None, // Will be populated later with more specific API
        });
    }
    
    Ok(display_infos)
}

#[cfg(target_os = "windows")]
fn get_displays_windows() -> Result<Vec<DisplayInfo>, String> {
    // Windows display enumeration will be implemented
    // For now, return a placeholder
    Ok(vec![DisplayInfo {
        id: 1,
        name: "Main Display".to_string(),
        width: 1920,
        height: 1080,
        scale_factor: 1.0,
        is_primary: true,
        refresh_rate: Some(60),
    }])
}

fn get_os_version() -> String {
    #[cfg(target_os = "macos")]
    {
        // Try to get macOS version
        std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    }
    
    #[cfg(target_os = "windows")]
    {
        // Try to get Windows version
        std::process::Command::new("cmd")
            .args(["/C", "ver"])
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "Unknown".to_string()
    }
}
