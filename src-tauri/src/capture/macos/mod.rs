//! macOS capture implementations
//!
//! Uses ScreenCaptureKit for screen capture and AVFoundation for audio/video.

pub mod permissions;
pub mod screen;

pub use permissions::*;
pub use screen::*;
