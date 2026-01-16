//! Platform-specific capture implementations
//!
//! This module provides screen, audio, and input capture for each platform.

pub mod traits;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

// Re-export platform-specific modules
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "windows")]
pub use windows::*;

pub use traits::*;
