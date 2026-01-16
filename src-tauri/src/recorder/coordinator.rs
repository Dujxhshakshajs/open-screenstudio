//! Recording coordinator
//!
//! Orchestrates multiple recording channels and manages the recording lifecycle.

use super::channel::{RecordingChannel, RecordingError, RecordingResult};
use super::state::{RecordingConfig, RecordingResult as RecordingOutput, RecordingSession, RecordingState};
use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::broadcast;

/// Events emitted during recording
#[derive(Debug, Clone)]
pub enum RecordingEvent {
    /// Recording started
    Started,
    /// Recording stopped
    Stopped,
    /// Recording paused
    Paused,
    /// Recording resumed
    Resumed,
    /// Error occurred
    Error(String),
    /// Recording progress update (duration in ms)
    Progress(f64),
}

/// Manages multiple recording channels
pub struct RecordingCoordinator {
    /// Current recording state
    state: Arc<RwLock<RecordingState>>,
    
    /// Recording channels
    channels: Vec<Box<dyn RecordingChannel>>,
    
    /// Recording sessions (one per pause/resume cycle)
    sessions: Vec<RecordingSession>,
    
    /// Current session index
    current_session: usize,
    
    /// Output directory for the current recording
    output_dir: Option<PathBuf>,
    
    /// Time when recording started (for process time calculation)
    start_time: Option<Instant>,
    
    /// Event broadcaster
    event_tx: broadcast::Sender<RecordingEvent>,
}

impl RecordingCoordinator {
    /// Create a new recording coordinator
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(100);
        Self {
            state: Arc::new(RwLock::new(RecordingState::Idle)),
            channels: Vec::new(),
            sessions: Vec::new(),
            current_session: 0,
            output_dir: None,
            start_time: None,
            event_tx,
        }
    }
    
    /// Add a recording channel
    pub fn add_channel(&mut self, channel: Box<dyn RecordingChannel>) {
        tracing::info!("Adding channel: {}", channel.id());
        self.channels.push(channel);
    }
    
    /// Get the current recording state
    pub fn state(&self) -> RecordingState {
        *self.state.read()
    }
    
    /// Subscribe to recording events
    pub fn subscribe(&self) -> broadcast::Receiver<RecordingEvent> {
        self.event_tx.subscribe()
    }
    
    /// Get the current process time in milliseconds
    fn process_time_ms(&self) -> f64 {
        self.start_time
            .map(|t| t.elapsed().as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
    
    /// Start recording
    pub async fn start(&mut self, config: RecordingConfig) -> RecordingResult<()> {
        let current_state = *self.state.read();
        if current_state != RecordingState::Idle {
            return Err(RecordingError::AlreadyRecording);
        }
        
        tracing::info!("Starting recording to: {}", config.output_dir);
        
        // Set up output directory
        let output_dir = PathBuf::from(&config.output_dir);
        std::fs::create_dir_all(&output_dir)?;
        
        // Create recording subdirectory
        let recording_dir = output_dir.join("recording");
        std::fs::create_dir_all(&recording_dir)?;
        
        self.output_dir = Some(output_dir);
        self.start_time = Some(Instant::now());
        self.current_session = 0;
        self.sessions.clear();
        
        // Create first session
        let session = RecordingSession::new(0, 0.0);
        self.sessions.push(session);
        
        // Initialize and start all channels
        for channel in &mut self.channels {
            channel.initialize(&recording_dir, 0).await?;
            channel.start().await?;
        }
        
        *self.state.write() = RecordingState::Recording;
        let _ = self.event_tx.send(RecordingEvent::Started);
        
        tracing::info!("Recording started");
        Ok(())
    }
    
    /// Stop recording
    pub async fn stop(&mut self) -> RecordingResult<RecordingOutput> {
        let current_state = *self.state.read();
        if current_state == RecordingState::Idle {
            return Err(RecordingError::NotRecording);
        }
        
        tracing::info!("Stopping recording");
        
        // End current session
        let end_time = self.process_time_ms();
        if let Some(session) = self.sessions.last_mut() {
            session.end(end_time);
        }
        
        // Stop all channels
        for channel in &mut self.channels {
            channel.stop().await?;
        }
        
        // Collect output files
        let mut output_files = Vec::new();
        for channel in &self.channels {
            output_files.extend(channel.output_files());
        }
        
        // Calculate total duration
        let total_duration_ms: f64 = self.sessions.iter().map(|s| s.duration_ms).sum();
        
        let result = RecordingOutput {
            bundle_path: self.output_dir
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default(),
            total_duration_ms,
            session_count: self.sessions.len(),
            output_files,
        };
        
        *self.state.write() = RecordingState::Complete;
        let _ = self.event_tx.send(RecordingEvent::Stopped);
        
        // Reset state
        self.output_dir = None;
        self.start_time = None;
        *self.state.write() = RecordingState::Idle;
        
        tracing::info!("Recording stopped. Duration: {}ms", total_duration_ms);
        Ok(result)
    }
    
    /// Pause recording
    pub async fn pause(&mut self) -> RecordingResult<()> {
        let current_state = *self.state.read();
        if current_state != RecordingState::Recording {
            return Err(RecordingError::NotRecording);
        }
        
        tracing::info!("Pausing recording");
        
        // End current session
        let end_time = self.process_time_ms();
        if let Some(session) = self.sessions.last_mut() {
            session.end(end_time);
        }
        
        // Pause all channels
        for channel in &mut self.channels {
            channel.pause().await?;
        }
        
        *self.state.write() = RecordingState::Paused;
        let _ = self.event_tx.send(RecordingEvent::Paused);
        
        Ok(())
    }
    
    /// Resume recording
    pub async fn resume(&mut self) -> RecordingResult<()> {
        let current_state = *self.state.read();
        if current_state != RecordingState::Paused {
            return Err(RecordingError::NotRecording);
        }
        
        tracing::info!("Resuming recording");
        
        // Create new session
        self.current_session += 1;
        let session = RecordingSession::new(self.current_session, self.process_time_ms());
        self.sessions.push(session);
        
        // Resume all channels
        for channel in &mut self.channels {
            channel.resume(self.current_session).await?;
        }
        
        *self.state.write() = RecordingState::Recording;
        let _ = self.event_tx.send(RecordingEvent::Resumed);
        
        Ok(())
    }
    
    /// Get recording duration in milliseconds
    pub fn duration_ms(&self) -> f64 {
        let completed: f64 = self.sessions.iter()
            .take(self.sessions.len().saturating_sub(1))
            .map(|s| s.duration_ms)
            .sum();
        
        let current = if *self.state.read() == RecordingState::Recording {
            self.sessions.last()
                .map(|s| self.process_time_ms() - s.process_time_start_ms)
                .unwrap_or(0.0)
        } else {
            self.sessions.last().map(|s| s.duration_ms).unwrap_or(0.0)
        };
        
        completed + current
    }
    
    /// Clear all channels
    pub fn clear_channels(&mut self) {
        self.channels.clear();
    }
}

impl Default for RecordingCoordinator {
    fn default() -> Self {
        Self::new()
    }
}
