//! Project-related Tauri commands
//!
//! These commands handle creating, opening, saving, and managing projects.

use crate::project::{bundle, schema::Project};
use std::path::PathBuf;
use tauri::State;
use tokio::sync::Mutex;

/// Application state for managing the current project
pub struct AppState {
    pub current_project: Mutex<Option<Project>>,
    pub current_project_path: Mutex<Option<PathBuf>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_project: Mutex::new(None),
            current_project_path: Mutex::new(None),
        }
    }
}

/// Create a new project
#[tauri::command]
pub async fn create_project(name: Option<String>) -> Result<Project, String> {
    let project_name = name.unwrap_or_else(|| "Untitled Recording".to_string());
    let project = Project::new(project_name);
    
    tracing::info!("Created new project: {}", project.id);
    
    Ok(project)
}

/// Open an existing project from a path
#[tauri::command]
pub async fn open_project(path: String) -> Result<Project, String> {
    let project_path = PathBuf::from(&path);
    
    tracing::info!("Opening project from: {:?}", project_path);
    
    let project = bundle::read_project(&project_path)
        .map_err(|e| format!("Failed to open project: {}", e))?;
    
    Ok(project)
}

/// Save the current project to a path
#[tauri::command]
pub async fn save_project(project: Project, path: String) -> Result<(), String> {
    let project_path = PathBuf::from(&path);
    
    tracing::info!("Saving project to: {:?}", project_path);
    
    bundle::write_project(&project, &project_path)
        .map_err(|e| format!("Failed to save project: {}", e))?;
    
    Ok(())
}

/// Get the current project state
#[tauri::command]
pub async fn get_project(state: State<'_, AppState>) -> Result<Option<Project>, String> {
    let project = state.current_project.lock().await;
    Ok(project.clone())
}
