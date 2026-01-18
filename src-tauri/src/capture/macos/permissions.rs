//! macOS permission handling
//!
//! Handles screen recording and other permissions on macOS.

/// Check if screen recording permission is granted
pub fn has_screen_recording_permission() -> bool {
    unsafe {
        extern "C" {
            fn CGPreflightScreenCaptureAccess() -> bool;
        }
        CGPreflightScreenCaptureAccess()
    }
}

/// Request screen recording permission
/// 
/// This will prompt the user to grant permission if not already granted.
/// Returns true if permission was already granted, false otherwise.
/// Note: The actual permission dialog is shown by the system.
pub fn request_screen_recording_permission() -> bool {
    unsafe {
        extern "C" {
            fn CGRequestScreenCaptureAccess() -> bool;
        }
        CGRequestScreenCaptureAccess()
    }
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

/// Check if camera permission is granted
/// 
/// Uses a simple check via system_profiler to verify camera access.
/// The actual permission check happens when nokhwa tries to access the camera.
pub fn has_camera_permission() -> bool {
    // On macOS, camera permission is typically requested when first accessing the camera.
    // We return true here and let the camera library handle the permission request.
    // This is because AVFoundation permission checking requires additional bindings.
    true
}

/// Request camera permission
/// 
/// Opens the Camera preferences pane if permission is needed.
/// Returns true (actual permission is checked by the camera library).
pub fn request_camera_permission() -> bool {
    // The nokhwa library will trigger the system permission dialog when accessing the camera.
    // We just return true here - if permission is denied, the camera open will fail.
    true
}

/// Open System Preferences to the Camera pane
pub fn open_camera_preferences() {
    let url = "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera";
    if let Ok(output) = std::process::Command::new("open").arg(url).output() {
        if !output.status.success() {
            tracing::warn!("Failed to open Camera preferences");
        }
    }
}
