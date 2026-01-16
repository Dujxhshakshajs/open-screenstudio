//! Capture trait definitions
//!
//! Platform-agnostic traits for capture sources.

use serde::{Deserialize, Serialize};

/// Information about a display/screen
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    /// Unique display ID
    pub id: u32,
    
    /// Display name
    pub name: String,
    
    /// Width in pixels
    pub width: u32,
    
    /// Height in pixels
    pub height: u32,
    
    /// Scale factor (e.g., 2.0 for Retina)
    pub scale_factor: f64,
    
    /// Whether this is the primary display
    pub is_primary: bool,
    
    /// Refresh rate in Hz (if available)
    pub refresh_rate: Option<u32>,
}

/// Information about a capture window
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    /// Unique window ID
    pub id: u32,
    
    /// Window title
    pub title: String,
    
    /// Application name
    pub app_name: String,
    
    /// Window bounds
    pub bounds: WindowBounds,
    
    /// Whether the window is on screen
    pub is_on_screen: bool,
}

/// Window bounds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Information about an audio device
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    /// Unique device ID
    pub id: String,
    
    /// Device name
    pub name: String,
    
    /// Whether this is an input device
    pub is_input: bool,
    
    /// Whether this is the default device
    pub is_default: bool,
}

/// Information about a camera/webcam
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraInfo {
    /// Unique device ID
    pub id: String,
    
    /// Device name
    pub name: String,
    
    /// Supported resolutions
    pub supported_resolutions: Vec<Resolution>,
}

/// Video resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

/// Check if screen recording permission is granted
pub fn has_screen_recording_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos::permissions::has_screen_recording_permission()
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows doesn't require explicit permission for screen capture
        true
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

/// Request screen recording permission
pub fn request_screen_recording_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos::permissions::request_screen_recording_permission()
    }
    
    #[cfg(target_os = "windows")]
    {
        true
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[cfg(target_os = "macos")]
mod macos {
    pub mod permissions {
        pub fn has_screen_recording_permission() -> bool {
            crate::capture::macos::permissions::has_screen_recording_permission()
        }
        
        pub fn request_screen_recording_permission() -> bool {
            crate::capture::macos::permissions::request_screen_recording_permission()
        }
    }
}
