//! macOS System Audio Capture using ScreenCaptureKit
//!
//! Uses Apple's ScreenCaptureKit framework (macOS 12.3+) to capture system audio
//! natively without requiring external virtual audio devices like BlackHole.
//!
//! TEMPORARILY DISABLED: screencapturekit crate version 1.5 requires macOS SDK 15.2+,
//! but we only have macOS SDK 15.0 installed. System audio capture is disabled
//! until Xcode is updated.
//!
//! To re-enable:
//! 1. Update Xcode to get macOS SDK 15.2+
//! 2. Uncomment screencapturekit dependency in Cargo.toml
//! 3. Restore the full implementation below

use crate::recorder::channel::{ChannelType, RecordingChannel, RecordingError, RecordingResult};
use async_trait::async_trait;
use std::path::Path;

/// Check if system audio capture is available
/// Returns false until Xcode is updated with macOS SDK 15.2+
pub fn is_system_audio_available() -> bool {
    false
}

/// System audio capture channel for macOS using ScreenCaptureKit
/// TEMPORARILY STUBBED - requires macOS SDK 15.2+
pub struct SystemAudioCaptureChannel {
    id: String,
    _display_id: u32,
}

impl SystemAudioCaptureChannel {
    /// Create a new system audio capture channel
    pub fn new(display_id: u32) -> Self {
        Self {
            id: "system-audio".to_string(),
            _display_id: display_id,
        }
    }

    /// Check if system audio capture is available
    pub fn is_available(&self) -> bool {
        is_system_audio_available()
    }
}

impl Default for SystemAudioCaptureChannel {
    fn default() -> Self {
        Self::new(1) // Default to primary display
    }
}

#[async_trait]
impl RecordingChannel for SystemAudioCaptureChannel {
    fn id(&self) -> &str {
        &self.id
    }

    fn channel_type(&self) -> ChannelType {
        ChannelType::SystemAudio
    }

    async fn initialize(&mut self, _output_dir: &Path, _session_index: usize) -> RecordingResult<()> {
        Err(RecordingError::ConfigurationError(
            "System audio capture is temporarily disabled. Please update Xcode to get macOS SDK 15.2+ to enable this feature.".to_string()
        ))
    }

    async fn start(&mut self) -> RecordingResult<()> {
        Err(RecordingError::ConfigurationError(
            "System audio capture is temporarily disabled. Please update Xcode to get macOS SDK 15.2+ to enable this feature.".to_string()
        ))
    }

    async fn stop(&mut self) -> RecordingResult<()> {
        Ok(())
    }

    async fn pause(&mut self) -> RecordingResult<()> {
        Ok(())
    }

    async fn resume(&mut self, _session_index: usize) -> RecordingResult<()> {
        Err(RecordingError::ConfigurationError(
            "System audio capture is temporarily disabled. Please update Xcode to get macOS SDK 15.2+ to enable this feature.".to_string()
        ))
    }

    fn is_recording(&self) -> bool {
        false
    }

    fn output_files(&self) -> Vec<String> {
        Vec::new()
    }
}
