//! Export pipeline orchestration
//!
//! This module coordinates the full export process including
//! decoding, cursor compositing, and encoding.

use crate::capture::input::types::{CursorInfo, MouseMove};
use crate::export::ffmpeg::{VideoDecoder, VideoEncoder};
use crate::export::types::{ExportError, ExportOptions, ExportProgress};
use crate::processing::cursor_smoothing::{smooth_cursor_data, SmoothedMouseMove};
use crate::project::schema::SpringConfig;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Recording bundle containing all input files for export
pub struct RecordingBundle {
    /// Path to the screen recording video
    pub screen_video: PathBuf,
    /// Path to microphone audio (if any)
    pub mic_audio: Option<PathBuf>,
    /// Path to system audio (if any)
    pub system_audio: Option<PathBuf>,
    /// Path to webcam video (if any)
    pub webcam_video: Option<PathBuf>,
    /// Mouse movement data
    pub mouse_moves: Vec<MouseMove>,
    /// Cursor images keyed by cursor ID
    pub cursor_images: HashMap<String, CursorImage>,
    /// Cursor metadata
    pub cursor_info: HashMap<String, CursorInfo>,
}

/// Loaded cursor image data
pub struct CursorImage {
    /// RGBA pixel data
    pub data: Vec<u8>,
    /// Image width
    pub width: u32,
    /// Image height
    pub height: u32,
}

/// Export pipeline for processing and encoding video
pub struct ExportPipeline {
    project_dir: PathBuf,
    options: ExportOptions,
    cancel_flag: Arc<AtomicBool>,
}

impl ExportPipeline {
    /// Create a new export pipeline
    pub fn new(project_dir: PathBuf, options: ExportOptions, cancel_flag: Arc<AtomicBool>) -> Self {
        Self {
            project_dir,
            options,
            cancel_flag,
        }
    }

    /// Run the export pipeline
    pub fn run<F>(&self, progress_callback: F) -> Result<(), ExportError>
    where
        F: Fn(ExportProgress) + Send,
    {
        tracing::info!("Starting export pipeline for {:?}", self.project_dir);

        // 1. Load recording bundle
        progress_callback(ExportProgress::preparing());
        let bundle = self.load_bundle()?;

        if self.is_cancelled() {
            return Err(ExportError::Cancelled);
        }

        // 2. Open video decoder to get source metadata
        let mut decoder = VideoDecoder::open(&bundle.screen_video)?;
        let (source_width, source_height) = decoder.dimensions();
        let total_frames = decoder.frame_count();
        let source_fps = decoder.fps();

        // 3. Smooth cursor data (if cursor is enabled) - using source FPS
        progress_callback(ExportProgress::smoothing_cursor(5.0));
        let smoothed_cursor = if self.options.include_cursor && !bundle.mouse_moves.is_empty() {
            let config = SpringConfig::default();
            smooth_cursor_data(&bundle.mouse_moves, &config, source_fps)
        } else {
            vec![]
        };
        progress_callback(ExportProgress::smoothing_cursor(10.0));

        if self.is_cancelled() {
            return Err(ExportError::Cancelled);
        }
        
        tracing::info!(
            "Decoding source video: {}x{}, {} frames @ {}fps",
            source_width,
            source_height,
            total_frames,
            source_fps
        );

        // 3b. Open webcam decoder if available
        tracing::info!(
            "Webcam options: include_webcam={}, webcam_video={:?}",
            self.options.include_webcam,
            bundle.webcam_video
        );
        let mut webcam_decoder = if self.options.include_webcam {
            if let Some(ref webcam_path) = bundle.webcam_video {
                tracing::info!("Attempting to open webcam video: {:?}", webcam_path);
                match VideoDecoder::open(webcam_path) {
                    Ok(dec) => {
                        tracing::info!(
                            "Webcam video opened successfully: {}x{}, {} frames @ {}fps",
                            dec.dimensions().0,
                            dec.dimensions().1,
                            dec.frame_count(),
                            dec.fps()
                        );
                        Some(dec)
                    }
                    Err(e) => {
                        tracing::error!("Failed to open webcam video: {}", e);
                        None
                    }
                }
            } else {
                tracing::warn!("include_webcam=true but no webcam video path in bundle");
                None
            }
        } else {
            tracing::info!("Webcam disabled in export options");
            None
        };

        // 4. Create encoder with source FPS (not requested output FPS)
        let mut encoder = VideoEncoder::new_with_audio(
            &self.options,
            source_width,
            source_height,
            source_fps,
            bundle.mic_audio.as_deref(),
            bundle.system_audio.as_deref(),
        )?;

        // 5. Process frames
        let mut frame_idx: u64 = 0;

        // Webcam overlay settings: bottom-right corner, 1/8 (12.5%) of screen width
        let webcam_scale = 0.125; // 1/8 of screen width
        let webcam_margin = 20u32; // pixels from edge

        // Track webcam frames for debugging
        let mut webcam_frames_drawn = 0u64;
        let mut webcam_frames_missed = 0u64;

        while let Some(mut frame) = decoder.read_frame()? {
            if self.is_cancelled() {
                return Err(ExportError::Cancelled);
            }

            // Validate frame size on first frame
            if frame_idx == 0 {
                let expected_size = (source_width * source_height * 4) as usize;
                if frame.len() != expected_size {
                    tracing::error!(
                        "FRAME SIZE MISMATCH: got {} bytes, expected {} bytes ({}x{}x4 RGBA)",
                        frame.len(),
                        expected_size,
                        source_width,
                        source_height
                    );
                    return Err(ExportError::Decoding(format!(
                        "Frame size mismatch: got {}, expected {} ({}x{}x4)",
                        frame.len(),
                        expected_size,
                        source_width,
                        source_height
                    )));
                }
                tracing::info!(
                    "First frame validated: {} bytes = {}x{}x4 RGBA",
                    frame.len(),
                    source_width,
                    source_height
                );
            }

            // Composite webcam overlay (before cursor so cursor appears on top)
            if let Some(ref mut webcam_dec) = webcam_decoder {
                match webcam_dec.read_frame() {
                    Ok(Some(webcam_frame)) => {
                        let (webcam_width, webcam_height) = webcam_dec.dimensions();
                        if frame_idx == 0 {
                            tracing::info!(
                                "Drawing webcam overlay: webcam={}x{}, screen={}x{}, scale={}, webcam_frame_len={}",
                                webcam_width,
                                webcam_height,
                                source_width,
                                source_height,
                                webcam_scale,
                                webcam_frame.len()
                            );
                        }
                        self.draw_webcam_overlay(
                            &mut frame,
                            source_width,
                            source_height,
                            &webcam_frame,
                            webcam_width,
                            webcam_height,
                            webcam_scale,
                            webcam_margin,
                        );
                        webcam_frames_drawn += 1;
                    }
                    Ok(None) => {
                        webcam_frames_missed += 1;
                        if webcam_frames_missed == 1 {
                            tracing::warn!("Webcam decoder returned no frame at frame_idx={}", frame_idx);
                        }
                    }
                    Err(e) => {
                        webcam_frames_missed += 1;
                        if webcam_frames_missed == 1 {
                            tracing::error!("Error reading webcam frame at frame_idx={}: {}", frame_idx, e);
                        }
                    }
                }
            }

            // Composite cursor overlay
            if self.options.include_cursor && !smoothed_cursor.is_empty() {
                let frame_time_ms = (frame_idx as f64 / source_fps) * 1000.0;
                if let Some(cursor_pos) = self.find_cursor_at_time(&smoothed_cursor, frame_time_ms)
                {
                    self.draw_cursor(
                        &mut frame,
                        source_width,
                        source_height,
                        cursor_pos,
                        &bundle.cursor_images,
                        &bundle.cursor_info,
                    );
                }
            }

            // Write frame to encoder
            encoder.write_frame(&frame)?;

            frame_idx += 1;

            // Update progress every 10 frames
            if frame_idx % 10 == 0 {
                progress_callback(ExportProgress::encoding(frame_idx, total_frames));
            }
        }

        // 6. Finalize
        progress_callback(ExportProgress::finalizing());
        
        // Log webcam stats
        if webcam_decoder.is_some() {
            tracing::info!(
                "Webcam overlay stats: {} frames drawn, {} frames missed",
                webcam_frames_drawn,
                webcam_frames_missed
            );
        }
        
        encoder.finish()?;

        progress_callback(ExportProgress::complete());
        tracing::info!(
            "Export complete: {} frames written to {:?}",
            frame_idx,
            self.options.output_path
        );

        Ok(())
    }

    /// Check if export was cancelled
    fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::Relaxed)
    }

    /// Load the recording bundle from the project directory
    fn load_bundle(&self) -> Result<RecordingBundle, ExportError> {
        let recording_dir = self.project_dir.join("recording");

        if !recording_dir.exists() {
            return Err(ExportError::BundleNotFound(format!(
                "Recording directory not found: {:?}",
                recording_dir
            )));
        }

        // Find the screen video (session 0)
        let screen_video = recording_dir.join("recording-0.mp4");
        if !screen_video.exists() {
            return Err(ExportError::BundleNotFound(format!(
                "Screen video not found: {:?}",
                screen_video
            )));
        }

        // Find optional audio files
        let mic_audio = {
            let path = recording_dir.join("recording-0-mic.m4a");
            if path.exists() {
                Some(path)
            } else {
                None
            }
        };

        let system_audio = {
            let path = recording_dir.join("recording-0-system.m4a");
            if path.exists() {
                Some(path)
            } else {
                None
            }
        };

        let webcam_video = {
            let path = recording_dir.join("recording-0-webcam.mp4");
            tracing::info!("Checking for webcam video at: {:?}, exists={}", path, path.exists());
            if path.exists() {
                Some(path)
            } else {
                None
            }
        };

        // Load mouse moves
        let mouse_moves = self.load_mouse_moves(&recording_dir)?;

        // Load cursor info and images
        let (cursor_info, cursor_images) = self.load_cursors(&recording_dir)?;

        tracing::info!(
            "Loaded recording bundle: video={:?}, mic={:?}, system={:?}, webcam={:?}, mouse_moves={}, cursors={}",
            screen_video,
            mic_audio,
            system_audio,
            webcam_video,
            mouse_moves.len(),
            cursor_info.len()
        );

        Ok(RecordingBundle {
            screen_video,
            mic_audio,
            system_audio,
            webcam_video,
            mouse_moves,
            cursor_images,
            cursor_info,
        })
    }

    /// Load mouse movement data from JSON
    fn load_mouse_moves(&self, recording_dir: &Path) -> Result<Vec<MouseMove>, ExportError> {
        let path = recording_dir.join("recording-0-mouse-moves.json");

        if !path.exists() {
            tracing::warn!("Mouse moves file not found: {:?}", path);
            return Ok(vec![]);
        }

        let content = std::fs::read_to_string(&path)?;
        let moves: Vec<MouseMove> = serde_json::from_str(&content)
            .map_err(|e| ExportError::BundleNotFound(format!("Failed to parse mouse moves: {}", e)))?;

        Ok(moves)
    }

    /// Load cursor metadata and images
    fn load_cursors(
        &self,
        recording_dir: &Path,
    ) -> Result<(HashMap<String, CursorInfo>, HashMap<String, CursorImage>), ExportError> {
        let cursors_json = recording_dir.join("recording-0-cursors.json");
        let cursors_dir = recording_dir.join("recording-0-cursors");

        let mut cursor_info = HashMap::new();
        let mut cursor_images = HashMap::new();

        if !cursors_json.exists() {
            tracing::warn!("Cursors metadata file not found: {:?}", cursors_json);
            return Ok((cursor_info, cursor_images));
        }

        // Load cursor metadata
        let content = std::fs::read_to_string(&cursors_json)?;
        let info_list: HashMap<String, CursorInfo> = serde_json::from_str(&content)
            .map_err(|e| ExportError::BundleNotFound(format!("Failed to parse cursors: {}", e)))?;

        // Load cursor images
        for (id, info) in info_list {
            let image_path = cursors_dir.join(&info.image_path);

            if image_path.exists() {
                match self.load_png_image(&image_path) {
                    Ok(image) => {
                        cursor_images.insert(id.clone(), image);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load cursor image {:?}: {}", image_path, e);
                    }
                }
            }

            cursor_info.insert(id, info);
        }

        Ok((cursor_info, cursor_images))
    }

    /// Load a PNG image as RGBA data
    fn load_png_image(&self, path: &Path) -> Result<CursorImage, ExportError> {
        let file = std::fs::File::open(path)?;
        let decoder = png::Decoder::new(file);
        let mut reader = decoder
            .read_info()
            .map_err(|e| ExportError::Decoding(format!("PNG decode error: {}", e)))?;

        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader
            .next_frame(&mut buf)
            .map_err(|e| ExportError::Decoding(format!("PNG frame error: {}", e)))?;

        // Convert to RGBA if needed
        let data = match info.color_type {
            png::ColorType::Rgba => buf[..info.buffer_size()].to_vec(),
            png::ColorType::Rgb => {
                // Add alpha channel
                let rgb = &buf[..info.buffer_size()];
                let mut rgba = Vec::with_capacity(rgb.len() / 3 * 4);
                for chunk in rgb.chunks(3) {
                    rgba.extend_from_slice(chunk);
                    rgba.push(255);
                }
                rgba
            }
            _ => {
                return Err(ExportError::Decoding(format!(
                    "Unsupported PNG color type: {:?}",
                    info.color_type
                )));
            }
        };

        Ok(CursorImage {
            data,
            width: info.width,
            height: info.height,
        })
    }

    /// Find the cursor position at a given time
    fn find_cursor_at_time<'a>(
        &self,
        smoothed_cursor: &'a [SmoothedMouseMove],
        time_ms: f64,
    ) -> Option<&'a SmoothedMouseMove> {
        if smoothed_cursor.is_empty() {
            return None;
        }

        // Binary search for the closest frame
        let idx = smoothed_cursor
            .binary_search_by(|m| m.process_time_ms.partial_cmp(&time_ms).unwrap())
            .unwrap_or_else(|i| i.saturating_sub(1).min(smoothed_cursor.len() - 1));

        smoothed_cursor.get(idx)
    }

    /// Draw cursor on a frame
    fn draw_cursor(
        &self,
        frame: &mut [u8],
        frame_width: u32,
        frame_height: u32,
        cursor_pos: &SmoothedMouseMove,
        cursor_images: &HashMap<String, CursorImage>,
        cursor_info: &HashMap<String, CursorInfo>,
    ) {
        // Get cursor image
        let Some(image) = cursor_images.get(&cursor_pos.cursor_id) else {
            return;
        };

        // Get hotspot offset
        let (hotspot_x, hotspot_y) = cursor_info
            .get(&cursor_pos.cursor_id)
            .map(|info| (info.hotspot_x as i32, info.hotspot_y as i32))
            .unwrap_or((0, 0));

        // Calculate cursor position (top-left corner, adjusted for hotspot)
        let cursor_x = cursor_pos.x as i32 - hotspot_x;
        let cursor_y = cursor_pos.y as i32 - hotspot_y;

        // Composite cursor onto frame using alpha blending
        for cy in 0..image.height as i32 {
            let frame_y = cursor_y + cy;
            if frame_y < 0 || frame_y >= frame_height as i32 {
                continue;
            }

            for cx in 0..image.width as i32 {
                let frame_x = cursor_x + cx;
                if frame_x < 0 || frame_x >= frame_width as i32 {
                    continue;
                }

                let cursor_idx = ((cy as u32 * image.width + cx as u32) * 4) as usize;
                let frame_idx = ((frame_y as u32 * frame_width + frame_x as u32) * 4) as usize;

                if cursor_idx + 3 >= image.data.len() || frame_idx + 3 >= frame.len() {
                    continue;
                }

                // Get cursor pixel (RGBA)
                let src_r = image.data[cursor_idx] as f32;
                let src_g = image.data[cursor_idx + 1] as f32;
                let src_b = image.data[cursor_idx + 2] as f32;
                let src_a = image.data[cursor_idx + 3] as f32 / 255.0;

                if src_a < 0.01 {
                    continue; // Skip fully transparent pixels
                }

                // Get frame pixel (RGBA)
                let dst_r = frame[frame_idx] as f32;
                let dst_g = frame[frame_idx + 1] as f32;
                let dst_b = frame[frame_idx + 2] as f32;

                // Alpha blend
                let out_r = src_r * src_a + dst_r * (1.0 - src_a);
                let out_g = src_g * src_a + dst_g * (1.0 - src_a);
                let out_b = src_b * src_a + dst_b * (1.0 - src_a);

                frame[frame_idx] = out_r.clamp(0.0, 255.0) as u8;
                frame[frame_idx + 1] = out_g.clamp(0.0, 255.0) as u8;
                frame[frame_idx + 2] = out_b.clamp(0.0, 255.0) as u8;
            }
        }
    }

    /// Draw webcam overlay on a frame (bottom-right corner with rounded corners)
    #[allow(clippy::too_many_arguments)]
    fn draw_webcam_overlay(
        &self,
        frame: &mut [u8],
        frame_width: u32,
        frame_height: u32,
        webcam_frame: &[u8],
        webcam_width: u32,
        webcam_height: u32,
        scale: f64,
        margin: u32,
    ) {
        // Calculate scaled webcam dimensions
        let scaled_width = (frame_width as f64 * scale) as u32;
        let scaled_height = (scaled_width as f64 * webcam_height as f64 / webcam_width as f64) as u32;

        // Position in bottom-right corner
        let dest_x = frame_width - scaled_width - margin;
        let dest_y = frame_height - scaled_height - margin;

        // Corner radius for rounded corners (10% of the smaller dimension)
        let corner_radius = (scaled_width.min(scaled_height) as f64 * 0.1) as i32;

        // Draw scaled webcam with simple nearest-neighbor scaling
        for dy in 0..scaled_height {
            for dx in 0..scaled_width {
                // Check if this pixel is within rounded corners
                if !self.is_inside_rounded_rect(
                    dx as i32,
                    dy as i32,
                    scaled_width as i32,
                    scaled_height as i32,
                    corner_radius,
                ) {
                    continue;
                }

                // Calculate source pixel (nearest neighbor)
                let src_x = (dx as f64 * webcam_width as f64 / scaled_width as f64) as u32;
                let src_y = (dy as f64 * webcam_height as f64 / scaled_height as f64) as u32;

                let src_x = src_x.min(webcam_width - 1);
                let src_y = src_y.min(webcam_height - 1);

                let src_idx = ((src_y * webcam_width + src_x) * 4) as usize;
                let dest_frame_x = dest_x + dx;
                let dest_frame_y = dest_y + dy;

                if dest_frame_x >= frame_width || dest_frame_y >= frame_height {
                    continue;
                }

                let dest_idx = ((dest_frame_y * frame_width + dest_frame_x) * 4) as usize;

                if src_idx + 3 >= webcam_frame.len() || dest_idx + 3 >= frame.len() {
                    continue;
                }

                // Copy pixel (webcam is RGBA)
                frame[dest_idx] = webcam_frame[src_idx];
                frame[dest_idx + 1] = webcam_frame[src_idx + 1];
                frame[dest_idx + 2] = webcam_frame[src_idx + 2];
                frame[dest_idx + 3] = 255; // Full opacity
            }
        }
    }

    /// Check if a point is inside a rounded rectangle
    fn is_inside_rounded_rect(
        &self,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
        radius: i32,
    ) -> bool {
        // Check corners
        // Top-left corner
        if x < radius && y < radius {
            let dx = radius - x;
            let dy = radius - y;
            return dx * dx + dy * dy <= radius * radius;
        }
        // Top-right corner
        if x >= width - radius && y < radius {
            let dx = x - (width - radius - 1);
            let dy = radius - y;
            return dx * dx + dy * dy <= radius * radius;
        }
        // Bottom-left corner
        if x < radius && y >= height - radius {
            let dx = radius - x;
            let dy = y - (height - radius - 1);
            return dx * dx + dy * dy <= radius * radius;
        }
        // Bottom-right corner
        if x >= width - radius && y >= height - radius {
            let dx = x - (width - radius - 1);
            let dy = y - (height - radius - 1);
            return dx * dx + dy * dy <= radius * radius;
        }
        // Inside the rect (not in corner regions)
        true
    }
}
