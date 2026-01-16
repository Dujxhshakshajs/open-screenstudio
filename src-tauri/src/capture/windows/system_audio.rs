//! Windows System Audio Capture using WASAPI Loopback
//!
//! On Windows, we can capture system audio using WASAPI loopback mode,
//! which captures the audio being played to an output device.

use crate::capture::audio::AudioEncoder;
use crate::recorder::channel::{ChannelType, RecordingChannel, RecordingError, RecordingResult};
use async_trait::async_trait;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, StreamConfig};
use parking_lot::Mutex as ParkingMutex;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Get the default output device for loopback capture
fn get_default_output_device() -> Option<Device> {
    let host = cpal::default_host();
    host.default_output_device()
}

/// System audio capture channel for Windows
///
/// Uses WASAPI loopback to capture system audio output.
pub struct SystemAudioCaptureChannel {
    id: String,
    is_recording: Arc<AtomicBool>,
    output_dir: Option<PathBuf>,
    session_index: usize,
    output_files: Arc<ParkingMutex<Vec<String>>>,
    encoder: Arc<ParkingMutex<Option<Arc<AudioEncoder>>>>,
    stream_handle: Arc<ParkingMutex<Option<std::thread::JoinHandle<()>>>>,
    sample_rate: u32,
    channels: u16,
    available: bool,
}

impl SystemAudioCaptureChannel {
    /// Create a new system audio capture channel
    pub fn new() -> Self {
        // Check if we can get the default output device
        let available = get_default_output_device().is_some();
        
        if !available {
            tracing::warn!("No default output device found for system audio capture");
        }

        Self {
            id: "system-audio".to_string(),
            is_recording: Arc::new(AtomicBool::new(false)),
            output_dir: None,
            session_index: 0,
            output_files: Arc::new(ParkingMutex::new(Vec::new())),
            encoder: Arc::new(ParkingMutex::new(None)),
            stream_handle: Arc::new(ParkingMutex::new(None)),
            sample_rate: 48000,
            channels: 2,
            available,
        }
    }

    /// Check if system audio capture is available
    pub fn is_available(&self) -> bool {
        self.available
    }
}

impl Default for SystemAudioCaptureChannel {
    fn default() -> Self {
        Self::new()
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

    async fn initialize(&mut self, output_dir: &Path, session_index: usize) -> RecordingResult<()> {
        if !self.available {
            tracing::warn!("System audio capture not available - no output device found");
            return Ok(());
        }

        let device = get_default_output_device().ok_or_else(|| {
            RecordingError::DeviceNotFound("No default output device".to_string())
        })?;

        let device_name = device.name().unwrap_or_else(|_| "Unknown".to_string());

        // Get the output config (we'll use this for loopback)
        let config = device.default_output_config().map_err(|e| {
            RecordingError::ConfigurationError(format!("Failed to get audio config: {}", e))
        })?;

        self.sample_rate = config.sample_rate().0;
        self.channels = config.channels();
        self.output_dir = Some(output_dir.to_path_buf());
        self.session_index = session_index;

        tracing::info!(
            "System audio channel initialized: {} ({}Hz, {}ch)",
            device_name,
            self.sample_rate,
            self.channels
        );
        Ok(())
    }

    async fn start(&mut self) -> RecordingResult<()> {
        if !self.available {
            tracing::warn!("Skipping system audio capture - not available");
            return Ok(());
        }

        if self.is_recording.load(Ordering::SeqCst) {
            return Err(RecordingError::AlreadyRecording);
        }

        let output_dir = self.output_dir.clone().ok_or_else(|| {
            RecordingError::ConfigurationError("Output directory not set".to_string())
        })?;

        // Create encoder
        let encoder = Arc::new(
            AudioEncoder::new(
                self.sample_rate,
                self.channels,
                &output_dir,
                self.session_index,
                "system",
            )
            .map_err(|e| {
                RecordingError::CaptureError(format!("Failed to start audio encoder: {}", e))
            })?,
        );
        *self.encoder.lock() = Some(encoder.clone());

        self.is_recording.store(true, Ordering::SeqCst);

        let is_recording = self.is_recording.clone();
        let sample_rate = self.sample_rate;
        let channels = self.channels;

        // Spawn a thread to handle the audio capture
        // Note: On Windows, we need to use WASAPI loopback which requires
        // building an input stream on the output device
        let handle = std::thread::spawn(move || {
            let host = cpal::default_host();
            
            let device = match host.default_output_device() {
                Some(d) => d,
                None => {
                    tracing::error!("Failed to get default output device");
                    return;
                }
            };

            // For WASAPI loopback, we need to create an input stream config
            // that matches the output device's format
            let stream_config = StreamConfig {
                channels,
                sample_rate: cpal::SampleRate(sample_rate),
                buffer_size: cpal::BufferSize::Default,
            };

            // Try to build a loopback stream
            // Note: cpal's WASAPI backend should support loopback capture
            // when building an input stream on an output device
            let stream = {
                let encoder_clone = encoder.clone();
                let is_rec = is_recording.clone();
                
                // Try F32 format first
                device.build_input_stream(
                    &stream_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if is_rec.load(Ordering::Relaxed) {
                            let bytes: Vec<u8> = data
                                .iter()
                                .flat_map(|&sample| sample.to_le_bytes())
                                .collect();
                            encoder_clone.write_samples(&bytes);
                        }
                    },
                    |err| tracing::error!("System audio stream error: {}", err),
                    None,
                )
            };

            let stream = match stream {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to build loopback stream: {}", e);
                    tracing::info!("WASAPI loopback may not be supported on this system");
                    return;
                }
            };

            if let Err(e) = stream.play() {
                tracing::error!("Failed to start audio stream: {}", e);
                return;
            }

            tracing::info!("System audio loopback stream started");

            // Keep thread alive while recording
            while is_recording.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }

            tracing::info!("System audio stream stopped");
        });

        *self.stream_handle.lock() = Some(handle);

        tracing::info!("System audio capture started");
        Ok(())
    }

    async fn stop(&mut self) -> RecordingResult<()> {
        if !self.available {
            return Ok(());
        }

        if !self.is_recording.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.is_recording.store(false, Ordering::SeqCst);

        // Wait for stream thread to finish
        if let Some(handle) = self.stream_handle.lock().take() {
            let _ = handle.join();
        }

        // Finish encoding
        if let Some(ref encoder) = *self.encoder.lock() {
            if let Ok(Some(output_file)) = encoder.finish() {
                self.output_files.lock().push(output_file);
            }
        }
        *self.encoder.lock() = None;

        tracing::info!("System audio capture stopped");
        Ok(())
    }

    async fn pause(&mut self) -> RecordingResult<()> {
        self.stop().await
    }

    async fn resume(&mut self, session_index: usize) -> RecordingResult<()> {
        self.session_index = session_index;
        self.start().await
    }

    fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    fn output_files(&self) -> Vec<String> {
        self.output_files.lock().clone()
    }
}
