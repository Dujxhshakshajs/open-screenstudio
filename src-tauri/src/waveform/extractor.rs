//! FFmpeg-based waveform extraction
//!
//! Extracts audio peaks from audio files using FFmpeg for visualization.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

/// Waveform data for an audio file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformData {
    /// Peaks normalized to 0.0-1.0 range
    pub peaks: Vec<f32>,
    /// Duration of the source audio in milliseconds
    pub duration_ms: u64,
    /// Samples per second (peaks.len() / duration in seconds)
    pub samples_per_second: u32,
}

/// Extract waveform peaks from an audio file
///
/// Uses FFmpeg to decode audio to raw PCM, then computes peaks
/// by taking the maximum absolute amplitude in each time bucket.
pub async fn extract_waveform(
    audio_path: &Path,
    samples_per_second: u32,
) -> Result<WaveformData, Box<dyn std::error::Error + Send + Sync>> {
    // Get audio duration first
    let duration_ms = get_audio_duration(audio_path).await?;
    let duration_secs = duration_ms as f64 / 1000.0;
    let total_peaks = (duration_secs * samples_per_second as f64).ceil() as usize;

    if total_peaks == 0 {
        return Ok(WaveformData {
            peaks: vec![],
            duration_ms,
            samples_per_second,
        });
    }

    // Use FFmpeg to extract raw audio samples
    // Output format: 16-bit signed little-endian mono at 8kHz (sufficient for visualization)
    let ffmpeg_output = Command::new("ffmpeg")
        .args([
            "-i",
            audio_path.to_str().unwrap(),
            "-ac",
            "1", // Mono
            "-ar",
            "8000", // 8kHz sample rate (enough for peaks)
            "-f",
            "s16le", // Raw 16-bit signed little-endian
            "-acodec",
            "pcm_s16le",
            "-", // Output to stdout
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await?;

    if !ffmpeg_output.status.success() {
        return Err("FFmpeg failed to extract audio".into());
    }

    // Process raw samples into peaks
    let samples = ffmpeg_output.stdout;
    let peaks = compute_peaks(&samples, 8000, samples_per_second, total_peaks);

    Ok(WaveformData {
        peaks,
        duration_ms,
        samples_per_second,
    })
}

/// Compute peaks from raw PCM samples
///
/// Takes raw 16-bit signed little-endian samples and computes the maximum
/// absolute amplitude for each time bucket.
fn compute_peaks(
    raw_samples: &[u8],
    source_sample_rate: u32,
    target_samples_per_second: u32,
    total_peaks: usize,
) -> Vec<f32> {
    // Convert bytes to i16 samples
    let samples: Vec<i16> = raw_samples
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    if samples.is_empty() {
        return vec![0.0; total_peaks];
    }

    // Calculate how many source samples per peak
    let samples_per_peak = source_sample_rate / target_samples_per_second;

    let mut peaks = Vec::with_capacity(total_peaks);

    for chunk in samples.chunks(samples_per_peak as usize) {
        // Find max absolute value in chunk, normalize to 0-1
        let max_amplitude = chunk
            .iter()
            .map(|&s| s.abs() as f32)
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(0.0);

        let normalized = max_amplitude / i16::MAX as f32;
        peaks.push(normalized);
    }

    // Pad or trim to exact size
    peaks.resize(total_peaks, 0.0);
    peaks
}

/// Get audio duration in milliseconds using ffprobe
async fn get_audio_duration(
    path: &Path,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path.to_str().unwrap(),
        ])
        .output()
        .await?;

    if !output.status.success() {
        return Err("ffprobe failed to get duration".into());
    }

    let duration_str = String::from_utf8_lossy(&output.stdout);
    let duration_secs: f64 = duration_str.trim().parse()?;
    Ok((duration_secs * 1000.0) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_peaks_empty() {
        let peaks = compute_peaks(&[], 8000, 50, 10);
        assert_eq!(peaks.len(), 10);
        assert!(peaks.iter().all(|&p| p == 0.0));
    }

    #[test]
    fn test_compute_peaks_basic() {
        // Create synthetic audio data - one second of samples at 8kHz
        // With peaks at different amplitudes
        let mut samples_bytes = Vec::new();
        for i in 0..8000 {
            // Sine wave with varying amplitude
            let amplitude = ((i as f32 / 8000.0) * 16000.0) as i16;
            samples_bytes.extend_from_slice(&amplitude.to_le_bytes());
        }

        let peaks = compute_peaks(&samples_bytes, 8000, 50, 50);

        assert_eq!(peaks.len(), 50);
        // All peaks should be in valid range
        assert!(peaks.iter().all(|&p| p >= 0.0 && p <= 1.0));
        // Later peaks should be larger (amplitude increases over time)
        assert!(peaks[45] > peaks[5]);
    }

    #[test]
    fn test_compute_peaks_normalization() {
        // Max amplitude sample
        let max_sample: i16 = i16::MAX;
        let samples_bytes: Vec<u8> = (0..160)
            .flat_map(|_| max_sample.to_le_bytes())
            .collect();

        let peaks = compute_peaks(&samples_bytes, 8000, 50, 1);

        assert_eq!(peaks.len(), 1);
        // Should be normalized to ~1.0
        assert!((peaks[0] - 1.0).abs() < 0.01);
    }
}
