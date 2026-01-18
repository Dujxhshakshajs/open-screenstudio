//! Export command handlers
//!
//! This module provides Tauri commands for video export functionality.

use crate::export::{ExportOptions, ExportPipeline};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

/// State for tracking active export jobs
#[derive(Default)]
pub struct ExportState {
    /// Cancel flag for the current export
    cancel_flag: Arc<AtomicBool>,
    /// Whether an export is currently running
    is_exporting: Arc<AtomicBool>,
}

/// Start an export job
///
/// This command starts the export process in a background task and
/// emits progress events via Tauri's event system.
#[tauri::command]
pub async fn start_export(
    app: AppHandle,
    state: State<'_, ExportState>,
    project_dir: String,
    options: ExportOptions,
) -> Result<(), String> {
    // Check if already exporting
    if state.is_exporting.load(Ordering::Relaxed) {
        return Err("An export is already in progress".to_string());
    }

    // Reset cancel flag
    state.cancel_flag.store(false, Ordering::Relaxed);
    state.is_exporting.store(true, Ordering::Relaxed);

    let cancel_flag = state.cancel_flag.clone();
    let is_exporting = state.is_exporting.clone();

    tracing::info!("Starting export for project: {}", project_dir);
    tracing::info!("Export options: {:?}", options);

    // Run export in background task
    tauri::async_runtime::spawn(async move {
        let pipeline = ExportPipeline::new(
            PathBuf::from(&project_dir),
            options,
            cancel_flag,
        );

        let app_handle = app.clone();
        let result = tokio::task::spawn_blocking(move || {
            pipeline.run(|progress| {
                // Emit progress event
                if let Err(e) = app_handle.emit("export-progress", &progress) {
                    tracing::warn!("Failed to emit export progress: {}", e);
                }
            })
        })
        .await;

        // Mark export as complete
        is_exporting.store(false, Ordering::Relaxed);

        // Handle result
        match result {
            Ok(Ok(())) => {
                tracing::info!("Export completed successfully");
                if let Err(e) = app.emit("export-complete", ()) {
                    tracing::warn!("Failed to emit export-complete: {}", e);
                }
            }
            Ok(Err(e)) => {
                tracing::error!("Export failed: {}", e);
                if let Err(emit_err) = app.emit("export-error", e.to_string()) {
                    tracing::warn!("Failed to emit export-error: {}", emit_err);
                }
            }
            Err(e) => {
                tracing::error!("Export task panicked: {}", e);
                if let Err(emit_err) = app.emit("export-error", format!("Export task panicked: {}", e)) {
                    tracing::warn!("Failed to emit export-error: {}", emit_err);
                }
            }
        }
    });

    Ok(())
}

/// Cancel the current export job
#[tauri::command]
pub fn cancel_export(state: State<'_, ExportState>) -> Result<(), String> {
    if !state.is_exporting.load(Ordering::Relaxed) {
        return Err("No export in progress".to_string());
    }

    tracing::info!("Cancelling export");
    state.cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

/// Check if an export is currently in progress
#[tauri::command]
pub fn is_exporting(state: State<'_, ExportState>) -> bool {
    state.is_exporting.load(Ordering::Relaxed)
}
