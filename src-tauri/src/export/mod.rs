//! Video export module
//!
//! This module provides functionality for exporting recordings to various
//! video formats with cursor overlay, audio mixing, and other effects.

pub mod ffmpeg;
pub mod pipeline;
pub mod types;

pub use ffmpeg::export_with_edits;
pub use pipeline::ExportPipeline;
pub use types::{
    ExportError, ExportFormat, ExportOptions, ExportProgress, ExportQuality, ExportSegment,
    ExportStage, TrackEdits,
};
