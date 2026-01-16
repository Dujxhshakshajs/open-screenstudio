//! Recording system module
//!
//! This module implements the multi-channel recording architecture:
//! - RecordingChannel trait for different capture sources
//! - RecordingCoordinator to orchestrate multiple channels
//! - Segment writer for HLS/fMP4 output

pub mod channel;
pub mod coordinator;
pub mod state;

pub use channel::RecordingChannel;
pub use coordinator::RecordingCoordinator;
pub use state::{RecordingState, RecordingSession};
