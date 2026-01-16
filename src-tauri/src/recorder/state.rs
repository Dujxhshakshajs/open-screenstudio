//! Recording state management
//!
//! Defines the recording state machine and session tracking.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Current state of the recording system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingState {
    /// No recording in progress
    Idle,
    /// Currently recording
    Recording,
    /// Recording is paused
    Paused,
    /// Recording completed
    Complete,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self::Idle
    }
}

/// Information about a recording session
/// 
/// A new session is created each time recording is paused and resumed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSession {
    /// Session index (0, 1, 2, ...)
    pub index: usize,
    
    /// Duration of this session in milliseconds
    pub duration_ms: f64,
    
    /// Process time when session started (relative to app start)
    pub process_time_start_ms: f64,
    
    /// Process time when session ended
    pub process_time_end_ms: f64,
    
    /// Unix timestamp when session started
    pub unix_start_ms: u64,
    
    /// Unix timestamp when session ended
    pub unix_end_ms: u64,
}

impl RecordingSession {
    /// Create a new session starting now
    pub fn new(index: usize, process_time_ms: f64) -> Self {
        let now = Utc::now();
        Self {
            index,
            duration_ms: 0.0,
            process_time_start_ms: process_time_ms,
            process_time_end_ms: process_time_ms,
            unix_start_ms: now.timestamp_millis() as u64,
            unix_end_ms: now.timestamp_millis() as u64,
        }
    }
    
    /// End the session
    pub fn end(&mut self, process_time_ms: f64) {
        self.process_time_end_ms = process_time_ms;
        self.duration_ms = self.process_time_end_ms - self.process_time_start_ms;
        self.unix_end_ms = Utc::now().timestamp_millis() as u64;
    }
}

/// Configuration for starting a recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingConfig {
    /// Display ID to capture
    pub display_id: u32,
    
    /// Whether to capture system audio
    pub capture_system_audio: bool,
    
    /// Whether to capture microphone
    pub capture_microphone: bool,
    
    /// Microphone device ID (if capturing)
    pub microphone_device_id: Option<String>,
    
    /// Whether to capture webcam
    pub capture_webcam: bool,
    
    /// Webcam device ID (if capturing)
    pub webcam_device_id: Option<String>,
    
    /// Whether to track mouse/keyboard input
    pub track_input: bool,
    
    /// Output directory for the recording
    pub output_dir: String,
}

/// Result of a completed recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingResult {
    /// Path to the recording bundle
    pub bundle_path: String,
    
    /// Total duration in milliseconds
    pub total_duration_ms: f64,
    
    /// Number of sessions
    pub session_count: usize,
    
    /// List of output files created
    pub output_files: Vec<String>,
}
