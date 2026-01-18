//! Export types and configuration
//!
//! This module defines the types used for video export configuration,
//! progress tracking, and error handling.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Export format options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Mp4,
    Webm,
    Gif,
}

impl ExportFormat {
    /// Get the file extension for this format
    pub fn extension(&self) -> &'static str {
        match self {
            ExportFormat::Mp4 => "mp4",
            ExportFormat::Webm => "webm",
            ExportFormat::Gif => "gif",
        }
    }

    /// Get the FFmpeg video codec for this format
    pub fn video_codec(&self) -> &'static str {
        match self {
            ExportFormat::Mp4 => "libx264",
            ExportFormat::Webm => "libvpx-vp9",
            ExportFormat::Gif => "gif",
        }
    }
}

/// Export quality levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportQuality {
    Low,
    Medium,
    High,
    Lossless,
}

impl ExportQuality {
    /// Get the CRF value for H.264/VP9 encoding
    /// Lower values = higher quality, larger files
    pub fn crf(&self) -> u8 {
        match self {
            ExportQuality::Low => 28,
            ExportQuality::Medium => 23,
            ExportQuality::High => 18,
            // CRF 1 is "visually lossless" - no perceptible quality loss
            // CRF 0 (true lossless) has compatibility issues with scaling and yuv420p
            ExportQuality::Lossless => 1,
        }
    }

    /// Get the FFmpeg preset for H.264 encoding
    pub fn h264_preset(&self) -> &'static str {
        match self {
            ExportQuality::Low => "faster",
            ExportQuality::Medium => "medium",
            ExportQuality::High => "slow",
            ExportQuality::Lossless => "veryslow",
        }
    }
}

/// Export configuration options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    /// Output format
    pub format: ExportFormat,
    /// Quality level
    pub quality: ExportQuality,
    /// Output width in pixels (None = use source resolution)
    pub width: Option<u32>,
    /// Output height in pixels (None = use source resolution)
    pub height: Option<u32>,
    /// Output frame rate (None = use source fps)
    pub fps: Option<u32>,
    /// Output file path
    pub output_path: String,
    /// Whether to include cursor overlay
    pub include_cursor: bool,
    /// Whether to include webcam overlay
    pub include_webcam: bool,
    /// Whether to include microphone audio
    pub include_mic_audio: bool,
    /// Whether to include system audio
    pub include_system_audio: bool,
}

/// Export progress stages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ExportStage {
    /// Preparing to export (loading files, etc.)
    Preparing,
    /// Smoothing cursor data
    SmoothingCursor,
    /// Encoding video frames
    Encoding,
    /// Finalizing output file
    Finalizing,
    /// Export completed successfully
    Complete,
    /// Export failed with error
    Error { message: String },
}

/// Export progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    /// Progress percentage (0.0 to 100.0)
    pub percent: f32,
    /// Current stage of export
    pub stage: ExportStage,
    /// Current frame being processed
    pub current_frame: u64,
    /// Total frames to process
    pub total_frames: u64,
}

impl ExportProgress {
    pub fn preparing() -> Self {
        Self {
            percent: 0.0,
            stage: ExportStage::Preparing,
            current_frame: 0,
            total_frames: 0,
        }
    }

    pub fn smoothing_cursor(percent: f32) -> Self {
        Self {
            percent,
            stage: ExportStage::SmoothingCursor,
            current_frame: 0,
            total_frames: 0,
        }
    }

    pub fn encoding(current_frame: u64, total_frames: u64) -> Self {
        let percent = if total_frames > 0 {
            10.0 + (current_frame as f32 / total_frames as f32) * 85.0
        } else {
            10.0
        };
        Self {
            percent,
            stage: ExportStage::Encoding,
            current_frame,
            total_frames,
        }
    }

    pub fn finalizing() -> Self {
        Self {
            percent: 95.0,
            stage: ExportStage::Finalizing,
            current_frame: 0,
            total_frames: 0,
        }
    }

    pub fn complete() -> Self {
        Self {
            percent: 100.0,
            stage: ExportStage::Complete,
            current_frame: 0,
            total_frames: 0,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            percent: 0.0,
            stage: ExportStage::Error { message },
            current_frame: 0,
            total_frames: 0,
        }
    }
}

/// Export errors
#[derive(Error, Debug)]
pub enum ExportError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("Recording bundle not found: {0}")]
    BundleNotFound(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Export cancelled")]
    Cancelled,

    #[error("Decoding error: {0}")]
    Decoding(String),

    #[error("Encoding error: {0}")]
    Encoding(String),
}

impl From<ExportError> for String {
    fn from(e: ExportError) -> String {
        e.to_string()
    }
}
