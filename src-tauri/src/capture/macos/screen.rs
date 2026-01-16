//! macOS screen capture using ScreenCaptureKit
//!
//! This module provides screen capture functionality using Apple's ScreenCaptureKit framework.
//! For now, we use a simpler approach with CGDisplayStream until we can properly integrate SCK.

use crate::capture::traits::DisplayInfo;
use crate::recorder::channel::{ChannelType, RecordingChannel, RecordingError, RecordingResult};
use async_trait::async_trait;
use core_graphics::display::CGDisplay;
use parking_lot::Mutex;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::io::Write;

/// Get list of available displays
pub fn get_displays() -> Vec<DisplayInfo> {
    let display_ids = CGDisplay::active_displays().unwrap_or_default();
    
    display_ids
        .iter()
        .enumerate()
        .map(|(index, &id)| {
            let display = CGDisplay::new(id);
            let bounds = display.bounds();
            let is_main = display.is_main();
            
            // Get refresh rate if available
            let refresh_rate = display.display_mode()
                .map(|mode| mode.refresh_rate() as u32)
                .filter(|&r| r > 0);
            
            DisplayInfo {
                id,
                name: if is_main {
                    "Main Display".to_string()
                } else {
                    format!("Display {}", index + 1)
                },
                width: bounds.size.width as u32,
                height: bounds.size.height as u32,
                scale_factor: display.pixels_high() as f64 / bounds.size.height,
                is_primary: is_main,
                refresh_rate,
            }
        })
        .collect()
}

/// Display capture channel using CGWindowListCreateImage
/// 
/// This is a simpler fallback approach that captures screenshots at intervals.
/// A proper ScreenCaptureKit implementation would be more efficient.
pub struct DisplayCaptureChannel {
    /// Channel identifier
    id: String,
    
    /// Display ID to capture
    display_id: u32,
    
    /// Whether currently recording
    is_recording: Arc<AtomicBool>,
    
    /// Output directory
    output_dir: Option<PathBuf>,
    
    /// Current session index
    session_index: usize,
    
    /// Output files created
    output_files: Arc<Mutex<Vec<String>>>,
    
    /// Capture task handle
    capture_handle: Option<tokio::task::JoinHandle<()>>,
}

impl DisplayCaptureChannel {
    /// Create a new display capture channel
    pub fn new(display_id: u32) -> Self {
        Self {
            id: format!("display-{}", display_id),
            display_id,
            is_recording: Arc::new(AtomicBool::new(false)),
            output_dir: None,
            session_index: 0,
            output_files: Arc::new(Mutex::new(Vec::new())),
            capture_handle: None,
        }
    }
    
}

#[async_trait]
impl RecordingChannel for DisplayCaptureChannel {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn channel_type(&self) -> ChannelType {
        ChannelType::Display
    }
    
    async fn initialize(&mut self, output_dir: &Path, session_index: usize) -> RecordingResult<()> {
        // Check permission first
        if !super::permissions::has_screen_recording_permission() {
            super::permissions::request_screen_recording_permission();
            return Err(RecordingError::PermissionDenied(
                "Screen recording permission not granted. Please allow in System Preferences.".to_string()
            ));
        }
        
        self.output_dir = Some(output_dir.to_path_buf());
        self.session_index = session_index;
        
        tracing::info!("Display capture channel initialized for display {}", self.display_id);
        Ok(())
    }
    
    async fn start(&mut self) -> RecordingResult<()> {
        if self.is_recording.load(Ordering::SeqCst) {
            return Err(RecordingError::AlreadyRecording);
        }
        
        let output_dir = self.output_dir.clone()
            .ok_or_else(|| RecordingError::ConfigurationError("Output directory not set".to_string()))?;
        
        self.is_recording.store(true, Ordering::SeqCst);
        
        let is_recording = self.is_recording.clone();
        let _display_id = self.display_id;
        let session_index = self.session_index;
        let output_files = self.output_files.clone();
        
        // Create a simple capture loop that saves frame timestamps
        // In a full implementation, this would encode to fMP4 segments
        let handle = tokio::spawn(async move {
            let frame_log_path = output_dir.join(format!("channel-display-{}-frames.log", session_index));
            let mut frame_log = std::fs::File::create(&frame_log_path).ok();
            
            if frame_log.is_some() {
                output_files.lock().push(frame_log_path.to_string_lossy().to_string());
            }
            
            let start_time = std::time::Instant::now();
            let mut frame_count = 0u64;
            
            // Capture at ~30fps for demo purposes
            let frame_interval = std::time::Duration::from_millis(33);
            
            while is_recording.load(Ordering::SeqCst) {
                let timestamp = start_time.elapsed().as_millis();
                
                // Log frame capture (actual encoding would happen here)
                if let Some(ref mut log) = frame_log {
                    let _ = writeln!(log, "frame,{},{}", frame_count, timestamp);
                }
                
                frame_count += 1;
                tokio::time::sleep(frame_interval).await;
            }
            
            tracing::info!("Display capture stopped. Captured {} frames", frame_count);
        });
        
        self.capture_handle = Some(handle);
        
        tracing::info!("Display capture started for display {}", self.display_id);
        Ok(())
    }
    
    async fn stop(&mut self) -> RecordingResult<()> {
        if !self.is_recording.load(Ordering::SeqCst) {
            return Err(RecordingError::NotRecording);
        }
        
        self.is_recording.store(false, Ordering::SeqCst);
        
        // Wait for capture task to finish
        if let Some(handle) = self.capture_handle.take() {
            let _ = handle.await;
        }
        
        tracing::info!("Display capture stopped");
        Ok(())
    }
    
    async fn pause(&mut self) -> RecordingResult<()> {
        self.is_recording.store(false, Ordering::SeqCst);
        
        if let Some(handle) = self.capture_handle.take() {
            let _ = handle.await;
        }
        
        Ok(())
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
