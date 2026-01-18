//! macOS webcam capture using nokhwa
//!
//! This module provides webcam capture functionality using the nokhwa crate.
//! Frames are captured and encoded to H.264 using FFmpeg.

use crate::capture::traits::{CameraInfo, Resolution};
use crate::recorder::channel::{ChannelType, RecordingChannel, RecordingError, RecordingResult};
use async_trait::async_trait;
use nokhwa::pixel_format::RgbAFormat;
use nokhwa::utils::{ApiBackend, CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType};
use nokhwa::Camera;
use parking_lot::Mutex as ParkingMutex;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

/// Get list of available cameras
pub fn get_cameras() -> Vec<CameraInfo> {
    // Use nokhwa to enumerate cameras
    match nokhwa::query(ApiBackend::Auto) {
        Ok(cameras) => cameras
            .into_iter()
            .map(|info| {
                let id = match info.index() {
                    CameraIndex::Index(i) => i.to_string(),
                    CameraIndex::String(s) => s.to_string(),
                };
                let name = info.human_name().to_string();

                // Common resolutions
                let resolutions = vec![
                    Resolution {
                        width: 1920,
                        height: 1080,
                    },
                    Resolution {
                        width: 1280,
                        height: 720,
                    },
                    Resolution {
                        width: 640,
                        height: 480,
                    },
                ];

                CameraInfo {
                    id,
                    name,
                    supported_resolutions: resolutions,
                }
            })
            .collect(),
        Err(e) => {
            tracing::warn!("Failed to enumerate cameras: {:?}", e);
            Vec::new()
        }
    }
}

/// FFmpeg encoder for webcam video output
struct FFmpegWebcamEncoder {
    process: ParkingMutex<Option<Child>>,
    frame_count: AtomicU64,
    running: AtomicBool,
    output_dir: PathBuf,
    session_index: usize,
}

impl FFmpegWebcamEncoder {
    fn new(
        width: u32,
        height: u32,
        fps: u32,
        output_dir: &Path,
        session_index: usize,
        pixel_format: &str,
    ) -> Result<Self, std::io::Error> {
        // Create output directory if it doesn't exist
        std::fs::create_dir_all(output_dir)?;

        let output_file = output_dir
            .join(format!("recording-{session_index}-webcam.mp4"))
            .to_string_lossy()
            .to_string();

        // Start FFmpeg process for MP4 output
        // Input: raw frames from stdin in native camera format (e.g., yuyv422)
        // Output: H.264 encoded MP4
        // FFmpeg handles the pixel format conversion efficiently (often hardware accelerated)
        let process = Command::new("ffmpeg")
            .args([
                "-y",                   // Overwrite output
                "-f",
                "rawvideo",             // Input format
                "-pixel_format",
                pixel_format,           // Native camera pixel format (yuyv422, nv12, etc.)
                "-video_size",
                &format!("{width}x{height}"),
                "-framerate",
                &fps.to_string(),
                "-i",
                "-",                    // Read from stdin
                "-c:v",
                "libx264",              // H.264 codec
                "-preset",
                "veryfast",             // Good balance of speed and compression
                "-pix_fmt",
                "yuv420p",              // Output pixel format (required for compatibility)
                "-crf",
                "18",                   // High quality
                "-g",
                &(fps * 2).to_string(), // GOP size = 2 seconds
                "-movflags",
                "+faststart",           // Move moov atom to start for streaming
                &output_file,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()?;

        tracing::info!(
            "Started FFmpeg webcam encoder: {}x{} @ {}fps, pixel_format={}, output: {}",
            width,
            height,
            fps,
            pixel_format,
            output_file
        );

        Ok(Self {
            process: ParkingMutex::new(Some(process)),
            frame_count: AtomicU64::new(0),
            running: AtomicBool::new(true),
            output_dir: output_dir.to_path_buf(),
            session_index,
        })
    }

    fn write_frame(&self, data: &[u8]) -> bool {
        if !self.running.load(Ordering::Relaxed) {
            return false;
        }

        let mut guard = self.process.lock();
        if let Some(ref mut process) = *guard {
            if let Some(ref mut stdin) = process.stdin {
                if stdin.write_all(data).is_ok() {
                    self.frame_count.fetch_add(1, Ordering::Relaxed);
                    return true;
                }
            }
        }
        false
    }

    fn frame_count(&self) -> u64 {
        self.frame_count.load(Ordering::Relaxed)
    }

    fn finish(&self) -> Result<Vec<String>, std::io::Error> {
        self.running.store(false, Ordering::Relaxed);
        let mut guard = self.process.lock();
        if let Some(mut process) = guard.take() {
            // Close stdin to signal EOF
            drop(process.stdin.take());
            // Wait for FFmpeg to finish
            let output = process.wait_with_output()?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                tracing::warn!(
                    "FFmpeg webcam exited with status {}: {}",
                    output.status,
                    stderr
                );
            }
        }

        // Find the output file
        let output_file = self
            .output_dir
            .join(format!("recording-{}-webcam.mp4", self.session_index))
            .to_string_lossy()
            .to_string();

        let mut files = Vec::new();
        if std::path::Path::new(&output_file).exists() {
            files.push(output_file.clone());
        }

        tracing::info!(
            "FFmpeg webcam finished: {} frames, output: {}",
            self.frame_count(),
            output_file,
        );

        Ok(files)
    }
}

/// Webcam capture channel using nokhwa
pub struct WebcamCaptureChannel {
    /// Channel identifier
    id: String,

    /// Device ID/index to capture from (None = default camera)
    device_id: Option<String>,

    /// Whether currently recording
    is_recording: Arc<AtomicBool>,

    /// Output directory
    output_dir: Option<PathBuf>,

    /// Current session index
    session_index: usize,

    /// Output files created
    output_files: Arc<ParkingMutex<Vec<String>>>,

    /// Requested capture width
    width: u32,

    /// Requested capture height
    height: u32,

    /// Capture FPS
    fps: u32,

    /// Capture thread handle
    capture_thread: Option<std::thread::JoinHandle<()>>,
}

impl WebcamCaptureChannel {
    /// Create a new webcam capture channel
    pub fn new(device_id: Option<String>, width: u32, height: u32, fps: u32) -> Self {
        Self {
            id: "webcam".to_string(),
            device_id,
            is_recording: Arc::new(AtomicBool::new(false)),
            output_dir: None,
            session_index: 0,
            output_files: Arc::new(ParkingMutex::new(Vec::new())),
            width,
            height,
            fps,
            capture_thread: None,
        }
    }

    /// Get camera index from device_id
    fn get_camera_index(&self) -> CameraIndex {
        match &self.device_id {
            Some(id) => {
                // Try to parse as integer first
                if let Ok(idx) = id.parse::<u32>() {
                    CameraIndex::Index(idx)
                } else {
                    CameraIndex::String(id.clone())
                }
            }
            None => CameraIndex::Index(0), // Default to first camera
        }
    }
}

#[async_trait]
impl RecordingChannel for WebcamCaptureChannel {
    fn id(&self) -> &str {
        &self.id
    }

    fn channel_type(&self) -> ChannelType {
        ChannelType::Webcam
    }

    async fn initialize(&mut self, output_dir: &Path, session_index: usize) -> RecordingResult<()> {
        // Check camera permission on macOS
        // Note: nokhwa handles permission requests internally

        // Check if FFmpeg is available
        if Command::new("ffmpeg").arg("-version").output().is_err() {
            return Err(RecordingError::ConfigurationError(
                "FFmpeg not found. Please install FFmpeg: brew install ffmpeg".to_string(),
            ));
        }

        // Check if camera is available
        let cameras = get_cameras();
        if cameras.is_empty() {
            return Err(RecordingError::DeviceNotFound(
                "No cameras found".to_string(),
            ));
        }

        self.output_dir = Some(output_dir.to_path_buf());
        self.session_index = session_index;

        tracing::info!(
            "Webcam capture channel initialized ({}x{} @ {}fps)",
            self.width,
            self.height,
            self.fps
        );
        Ok(())
    }

    async fn start(&mut self) -> RecordingResult<()> {
        if self.is_recording.load(Ordering::SeqCst) {
            return Err(RecordingError::AlreadyRecording);
        }

        let output_dir = self.output_dir.clone().ok_or_else(|| {
            RecordingError::ConfigurationError("Output directory not set".to_string())
        })?;

        self.is_recording.store(true, Ordering::SeqCst);

        // Start capture in a background thread
        // We create the encoder inside the thread after we know the actual resolution
        let camera_index = self.get_camera_index();
        let is_recording = self.is_recording.clone();
        let output_files = self.output_files.clone();
        let requested_width = self.width;
        let requested_height = self.height;
        let fps = self.fps;
        let session_index = self.session_index;

        let handle = std::thread::spawn(move || {
            // Request highest resolution available - we'll get actual resolution after opening
            let format = RequestedFormat::new::<RgbAFormat>(
                RequestedFormatType::AbsoluteHighestResolution
            );

            // Open camera
            let camera_result = Camera::new(camera_index.clone(), format);

            let mut camera = match camera_result {
                Ok(c) => c,
                Err(e) => {
                    tracing::error!("Failed to open camera {:?}: {:?}", camera_index, e);
                    return;
                }
            };

            // Open the camera stream
            if let Err(e) = camera.open_stream() {
                tracing::error!("Failed to open camera stream: {:?}", e);
                return;
            }

            // Get actual camera resolution and framerate
            let camera_format = camera.camera_format();
            let actual_width = camera_format.resolution().width();
            let actual_height = camera_format.resolution().height();
            let actual_fps = camera_format.frame_rate();
            let frame_format = camera_format.format();
            
            // Map nokhwa FrameFormat to FFmpeg pixel format string
            let ffmpeg_pix_fmt = match frame_format {
                FrameFormat::YUYV => "yuyv422",
                FrameFormat::NV12 => "nv12",
                FrameFormat::RAWRGB => "rgb24",
                FrameFormat::MJPEG => "mjpeg",  // FFmpeg can decode MJPEG
                _ => {
                    tracing::warn!("Unknown camera format {:?}, falling back to yuyv422", frame_format);
                    "yuyv422"
                }
            };
            
            tracing::info!(
                "Webcam opened: {}x{} @ {}fps, format={:?} -> ffmpeg pix_fmt={} (requested {}x{} @ {}fps)",
                actual_width,
                actual_height,
                actual_fps,
                frame_format,
                ffmpeg_pix_fmt,
                requested_width,
                requested_height,
                fps
            );

            // Create FFmpeg encoder with actual resolution, framerate, and pixel format
            // IMPORTANT: Pass raw frames directly - FFmpeg handles conversion efficiently
            let encoder = match FFmpegWebcamEncoder::new(
                actual_width,
                actual_height,
                actual_fps,
                &output_dir,
                session_index,
                ffmpeg_pix_fmt,
            ) {
                Ok(e) => Arc::new(e),
                Err(e) => {
                    tracing::error!("Failed to start FFmpeg encoder: {:?}", e);
                    let _ = camera.stop_stream();
                    return;
                }
            };

            tracing::info!("Webcam capture started at {}fps (raw {} frames)", actual_fps, ffmpeg_pix_fmt);

            let mut frame_logged = false;
            let mut frame_count: u64 = 0;
            let capture_start = std::time::Instant::now();

            while is_recording.load(Ordering::SeqCst) {
                // Capture frame - this blocks until camera delivers next frame
                // Do NOT add artificial delay, the camera controls the timing
                match camera.frame() {
                    Ok(frame) => {
                        // Pass raw frame buffer directly to FFmpeg - NO DECODING
                        // This is much faster than decode_image() which does CPU conversion
                        let raw_data = frame.buffer();
                        
                        // Log first frame info
                        if !frame_logged {
                            // Calculate expected size based on format
                            let expected_size = match frame_format {
                                FrameFormat::YUYV => actual_width * actual_height * 2,  // 2 bytes per pixel
                                FrameFormat::NV12 => actual_width * actual_height * 3 / 2,  // 1.5 bytes per pixel
                                FrameFormat::RAWRGB => actual_width * actual_height * 3,  // 3 bytes per pixel
                                _ => actual_width * actual_height * 2,  // Default assumption
                            };
                            tracing::info!(
                                "First webcam frame: {} bytes (expected ~{} for {})",
                                raw_data.len(),
                                expected_size,
                                ffmpeg_pix_fmt
                            );
                            frame_logged = true;
                        }
                        
                        encoder.write_frame(raw_data);
                        frame_count += 1;
                    }
                    Err(e) => {
                        tracing::debug!("Failed to capture frame: {:?}", e);
                    }
                }
            }
            
            let elapsed = capture_start.elapsed();
            let actual_capture_fps = frame_count as f64 / elapsed.as_secs_f64();
            tracing::info!(
                "Webcam captured {} frames in {:.2}s ({:.1} fps actual)",
                frame_count,
                elapsed.as_secs_f64(),
                actual_capture_fps
            );

            // Close the camera
            if let Err(e) = camera.stop_stream() {
                tracing::warn!("Error stopping camera stream: {:?}", e);
            }

            // Finish encoding
            match encoder.finish() {
                Ok(files) => {
                    output_files.lock().extend(files);
                }
                Err(e) => {
                    tracing::error!("Failed to finish webcam encoding: {:?}", e);
                }
            }

            tracing::info!("Webcam capture thread stopped");
        });

        self.capture_thread = Some(handle);

        tracing::info!(
            "Webcam capture starting (requested {}x{} @ {}fps)",
            self.width,
            self.height,
            self.fps
        );
        Ok(())
    }

    async fn stop(&mut self) -> RecordingResult<()> {
        if !self.is_recording.load(Ordering::SeqCst) {
            return Err(RecordingError::NotRecording);
        }

        self.is_recording.store(false, Ordering::SeqCst);

        // Wait for capture thread to finish (it handles encoder finalization)
        if let Some(handle) = self.capture_thread.take() {
            let _ = handle.join();
        }

        tracing::info!("Webcam capture stopped");
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
