//! Windows screen capture using GDI BitBlt
//!
//! This module provides screen capture functionality using the Windows GDI API.
//! Frames are captured and encoded to H.264 using FFmpeg.

use crate::capture::traits::DisplayInfo;
use crate::recorder::channel::{ChannelType, RecordingChannel, RecordingError, RecordingResult};
use async_trait::async_trait;
use parking_lot::Mutex as ParkingMutex;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

#[cfg(target_os = "windows")]
use windows::{
    Win32::Foundation::{BOOL, LPARAM, RECT},
    Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        EnumDisplayMonitors, GetDIBits, GetMonitorInfoW, SelectObject, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC, HMONITOR, MONITORINFOEXW, SRCCOPY,
    },
    Win32::UI::WindowsAndMessaging::GetDesktopWindow,
};

/// Get list of available displays on Windows
#[cfg(target_os = "windows")]
pub fn get_displays() -> Vec<DisplayInfo> {
    use std::mem::zeroed;

    let mut displays = Vec::new();
    let displays_ptr = &mut displays as *mut Vec<DisplayInfo>;

    unsafe extern "system" fn enum_monitors_callback(
        hmonitor: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let displays = &mut *(lparam.0 as *mut Vec<DisplayInfo>);

        let mut monitor_info: MONITORINFOEXW = unsafe { zeroed() };
        monitor_info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;

        if unsafe { GetMonitorInfoW(hmonitor, &mut monitor_info.monitorInfo) }.as_bool() {
            let rect = monitor_info.monitorInfo.rcMonitor;
            let width = (rect.right - rect.left) as u32;
            let height = (rect.bottom - rect.top) as u32;
            let is_primary = (monitor_info.monitorInfo.dwFlags & 1) != 0; // MONITORINFOF_PRIMARY

            // Convert device name to string
            let name_len = monitor_info
                .szDevice
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(monitor_info.szDevice.len());
            let name = String::from_utf16_lossy(&monitor_info.szDevice[..name_len]);

            displays.push(DisplayInfo {
                id: displays.len() as u32,
                name: if is_primary {
                    "Primary Display".to_string()
                } else {
                    name
                },
                width,
                height,
                scale_factor: 1.0, // TODO: Get actual DPI scaling
                is_primary,
                refresh_rate: Some(60), // TODO: Get actual refresh rate
            });
        }

        BOOL::from(true)
    }

    unsafe {
        let _ = EnumDisplayMonitors(
            HDC::default(),
            None,
            Some(enum_monitors_callback),
            LPARAM(displays_ptr as isize),
        );
    }

    // If no displays found, return a default
    if displays.is_empty() {
        displays.push(DisplayInfo {
            id: 0,
            name: "Primary Display".to_string(),
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
            is_primary: true,
            refresh_rate: Some(60),
        });
    }

    displays
}

#[cfg(not(target_os = "windows"))]
pub fn get_displays() -> Vec<DisplayInfo> {
    vec![DisplayInfo {
        id: 0,
        name: "Primary Display".to_string(),
        width: 1920,
        height: 1080,
        scale_factor: 1.0,
        is_primary: true,
        refresh_rate: Some(60),
    }]
}

/// Capture a single frame from the screen using BitBlt
#[cfg(target_os = "windows")]
fn capture_display_frame(display_id: u32) -> Option<(Vec<u8>, u32, u32)> {
    use std::mem::zeroed;
    use windows::Win32::Graphics::Gdi::GetDC;

    unsafe {
        // Get screen dimensions
        let displays = get_displays();
        let display = displays.get(display_id as usize)?;
        let width = display.width;
        let height = display.height;

        // Get device context for the desktop
        let hwnd = GetDesktopWindow();
        let hdc_screen = GetDC(hwnd);
        if hdc_screen.is_invalid() {
            return None;
        }

        // Create compatible DC and bitmap
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            return None;
        }

        let hbitmap = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
        if hbitmap.is_invalid() {
            DeleteDC(hdc_mem);
            return None;
        }

        // Select bitmap into memory DC
        let old_bitmap = SelectObject(hdc_mem, hbitmap);

        // Copy screen to bitmap
        let result = BitBlt(
            hdc_mem,
            0,
            0,
            width as i32,
            height as i32,
            hdc_screen,
            0,
            0,
            SRCCOPY,
        );

        if !result.as_bool() {
            SelectObject(hdc_mem, old_bitmap);
            DeleteObject(hbitmap);
            DeleteDC(hdc_mem);
            return None;
        }

        // Prepare bitmap info for GetDIBits
        let mut bmi: BITMAPINFO = zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width as i32;
        bmi.bmiHeader.biHeight = -(height as i32); // Negative for top-down
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32; // BGRA
        bmi.bmiHeader.biCompression = BI_RGB.0;

        // Allocate buffer for pixel data
        let buffer_size = (width * height * 4) as usize;
        let mut buffer = vec![0u8; buffer_size];

        // Get the bitmap bits
        let lines = GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            height,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // Cleanup
        SelectObject(hdc_mem, old_bitmap);
        DeleteObject(hbitmap);
        DeleteDC(hdc_mem);

        if lines == 0 {
            return None;
        }

        Some((buffer, width, height))
    }
}

#[cfg(not(target_os = "windows"))]
fn capture_display_frame(_display_id: u32) -> Option<(Vec<u8>, u32, u32)> {
    None
}

/// FFmpeg encoder for MP4 output
struct FFmpegEncoder {
    process: ParkingMutex<Option<Child>>,
    frame_count: AtomicU64,
    running: AtomicBool,
    output_dir: PathBuf,
    session_index: usize,
}

impl FFmpegEncoder {
    fn new(
        width: u32,
        height: u32,
        fps: u32,
        output_dir: &Path,
        session_index: usize,
    ) -> Result<Self, std::io::Error> {
        std::fs::create_dir_all(output_dir)?;

        let output_file = output_dir
            .join(format!("recording-{session_index}.mp4"))
            .to_string_lossy()
            .to_string();

        // Start FFmpeg process
        let process = Command::new("ffmpeg")
            .args([
                "-y",
                "-f",
                "rawvideo",
                "-pixel_format",
                "bgra",
                "-video_size",
                &format!("{width}x{height}"),
                "-framerate",
                &fps.to_string(),
                "-i",
                "-",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "18",
                "-g",
                &(fps * 2).to_string(),
                "-movflags",
                "+faststart",
                &output_file,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()?;

        tracing::info!(
            "Started FFmpeg encoder: {}x{} @ {}fps, output: {:?}",
            width,
            height,
            fps,
            output_dir
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
            drop(process.stdin.take());
            let output = process.wait_with_output()?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                tracing::warn!("FFmpeg exited with status {}: {}", output.status, stderr);
            }
        }

        let output_file = self
            .output_dir
            .join(format!("recording-{}.mp4", self.session_index))
            .to_string_lossy()
            .to_string();

        let mut files = Vec::new();
        if std::path::Path::new(&output_file).exists() {
            files.push(output_file.clone());
        }

        tracing::info!(
            "FFmpeg finished: {} frames, output: {}",
            self.frame_count(),
            output_file,
        );

        Ok(files)
    }
}

/// Display capture channel for Windows
pub struct DisplayCaptureChannel {
    id: String,
    display_id: u32,
    is_recording: Arc<AtomicBool>,
    output_dir: Option<PathBuf>,
    session_index: usize,
    output_files: Arc<ParkingMutex<Vec<String>>>,
    encoder: Option<Arc<FFmpegEncoder>>,
    capture_handle: Option<tokio::task::JoinHandle<()>>,
    width: u32,
    height: u32,
    fps: u32,
}

impl DisplayCaptureChannel {
    pub fn new(display_id: u32) -> Self {
        Self {
            id: format!("display-{}", display_id),
            display_id,
            is_recording: Arc::new(AtomicBool::new(false)),
            output_dir: None,
            session_index: 0,
            output_files: Arc::new(ParkingMutex::new(Vec::new())),
            encoder: None,
            capture_handle: None,
            width: 1920,
            height: 1080,
            fps: 30,
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
        // Check if FFmpeg is available
        if Command::new("ffmpeg").arg("-version").output().is_err() {
            return Err(RecordingError::ConfigurationError(
                "FFmpeg not found. Please install FFmpeg and add it to PATH.".to_string(),
            ));
        }

        // Get display info
        let displays = get_displays();
        if let Some(display) = displays.get(self.display_id as usize) {
            self.width = display.width;
            self.height = display.height;
        }

        self.output_dir = Some(output_dir.to_path_buf());
        self.session_index = session_index;

        tracing::info!(
            "Windows display capture initialized for display {} ({}x{})",
            self.display_id,
            self.width,
            self.height
        );
        Ok(())
    }

    async fn start(&mut self) -> RecordingResult<()> {
        if self.is_recording.load(Ordering::SeqCst) {
            return Err(RecordingError::AlreadyRecording);
        }

        let output_dir = self
            .output_dir
            .clone()
            .ok_or_else(|| RecordingError::ConfigurationError("Output directory not set".to_string()))?;

        // Capture first frame to determine actual dimensions
        let (first_frame, actual_width, actual_height) = capture_display_frame(self.display_id)
            .ok_or_else(|| RecordingError::CaptureError("Failed to capture initial frame".to_string()))?;

        self.width = actual_width;
        self.height = actual_height;

        tracing::info!(
            "Actual capture dimensions: {}x{} (from first frame)",
            actual_width,
            actual_height
        );

        // Create FFmpeg encoder
        let encoder = Arc::new(
            FFmpegEncoder::new(self.width, self.height, self.fps, &output_dir, self.session_index)
                .map_err(|e| RecordingError::CaptureError(format!("Failed to start FFmpeg: {}", e)))?,
        );

        // Write first frame
        let expected_size = (self.width * self.height * 4) as usize;
        if first_frame.len() >= expected_size {
            encoder.write_frame(&first_frame[..expected_size]);
        }

        self.encoder = Some(encoder.clone());
        self.is_recording.store(true, Ordering::SeqCst);

        // Start capture loop
        let is_recording = self.is_recording.clone();
        let display_id = self.display_id;
        let fps = self.fps;
        let width = self.width;
        let height = self.height;

        let handle = tokio::spawn(async move {
            let frame_interval = std::time::Duration::from_millis(1000 / fps as u64);
            let expected_size = (width * height * 4) as usize;

            while is_recording.load(Ordering::SeqCst) {
                let start = std::time::Instant::now();

                if let Some((data, _w, _h)) = capture_display_frame(display_id) {
                    if data.len() >= expected_size {
                        encoder.write_frame(&data[..expected_size]);
                    }
                }

                let count = encoder.frame_count();
                if count.is_multiple_of(60) && count > 0 {
                    tracing::debug!(
                        "Captured {} frames ({:.1}s) at {}x{}",
                        count,
                        count as f64 / fps as f64,
                        width,
                        height
                    );
                }

                let elapsed = start.elapsed();
                if elapsed < frame_interval {
                    tokio::time::sleep(frame_interval - elapsed).await;
                }
            }
        });

        self.capture_handle = Some(handle);

        tracing::info!(
            "Windows display capture started for display {} ({}x{} @ {}fps)",
            self.display_id,
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

        if let Some(handle) = self.capture_handle.take() {
            let _ = handle.await;
        }

        if let Some(ref encoder) = self.encoder {
            let files = encoder
                .finish()
                .map_err(|e| RecordingError::CaptureError(format!("Failed to finish encoding: {}", e)))?;
            self.output_files.lock().extend(files);
        }
        self.encoder = None;

        tracing::info!("Windows display capture stopped");
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
