//! Waveform extraction module
//!
//! Extracts audio waveform peaks from audio files for visualization.

mod extractor;

pub use extractor::{extract_waveform, WaveformData};

use tauri::command;

/// Tauri command to extract waveform data from an audio file
#[command]
pub async fn get_waveform(
    audio_path: String,
    samples_per_second: Option<u32>,
) -> Result<WaveformData, String> {
    let sps = samples_per_second.unwrap_or(50); // 50 peaks/sec for smooth visualization
    let path = std::path::Path::new(&audio_path);

    if !path.exists() {
        return Err(format!("Audio file not found: {}", audio_path));
    }

    extract_waveform(path, sps)
        .await
        .map_err(|e| e.to_string())
}
