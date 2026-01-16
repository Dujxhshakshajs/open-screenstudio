//! Windows capture implementations
//!
//! Uses Windows.Graphics.Capture for screen capture.

pub mod screen;

pub use screen::*;

/// Windows doesn't require explicit permission for screen capture
pub mod permissions {
    pub fn has_screen_recording_permission() -> bool {
        true
    }
    
    pub fn request_screen_recording_permission() -> bool {
        true
    }
}
