//! macOS permission handling
//!
//! Handles screen recording and other permissions on macOS.

use core_graphics::access::ScreenCaptureAccess;

/// Check if screen recording permission is granted
pub fn has_screen_recording_permission() -> bool {
    ScreenCaptureAccess::preflight()
}

/// Request screen recording permission
/// 
/// This will prompt the user to grant permission if not already granted.
/// Returns true if permission was already granted, false otherwise.
/// Note: The actual permission dialog is shown by the system.
pub fn request_screen_recording_permission() -> bool {
    ScreenCaptureAccess::request()
}

/// Open System Preferences to the Screen Recording pane
pub fn open_screen_recording_preferences() {
    let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
    if let Ok(output) = std::process::Command::new("open").arg(url).output() {
        if !output.status.success() {
            tracing::warn!("Failed to open Screen Recording preferences");
        }
    }
}

/// Check if accessibility permission is granted (needed for input tracking)
pub fn has_accessibility_permission() -> bool {
    // Use AXIsProcessTrusted
    unsafe {
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        AXIsProcessTrusted()
    }
}

/// Request accessibility permission
pub fn request_accessibility_permission() {
    let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    if let Ok(output) = std::process::Command::new("open").arg(url).output() {
        if !output.status.success() {
            tracing::warn!("Failed to open Accessibility preferences");
        }
    }
}
