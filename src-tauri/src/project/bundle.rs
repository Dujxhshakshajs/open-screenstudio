//! Project bundle read/write operations
//!
//! This module handles reading and writing .osp project bundles.
//! A bundle is a directory containing:
//! - meta.json: Version and metadata
//! - project.json: Project configuration and scenes
//! - markers.json: User-defined markers
//! - recording/: Directory with recorded media and data

use super::schema::{Marker, Project, ProjectMeta};
use std::fs;
use std::path::Path;
use thiserror::Error;

/// Bundle-related errors
#[derive(Error, Debug)]
pub enum BundleError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Invalid bundle: {0}")]
    InvalidBundle(String),
    
    #[error("Missing required file: {0}")]
    MissingFile(String),
}

/// Read a project from a bundle directory
pub fn read_project(bundle_path: &Path) -> Result<Project, BundleError> {
    // Verify this is a valid bundle directory
    if !bundle_path.is_dir() {
        return Err(BundleError::InvalidBundle(
            "Path is not a directory".to_string(),
        ));
    }
    
    // Check for required files
    let project_path = bundle_path.join("project.json");
    if !project_path.exists() {
        return Err(BundleError::MissingFile("project.json".to_string()));
    }
    
    // Read and parse project.json
    let project_content = fs::read_to_string(&project_path)?;
    let project: Project = serde_json::from_str(&project_content)?;
    
    tracing::debug!("Loaded project '{}' from {:?}", project.name, bundle_path);
    
    Ok(project)
}

/// Read project metadata from a bundle
pub fn read_meta(bundle_path: &Path) -> Result<ProjectMeta, BundleError> {
    let meta_path = bundle_path.join("meta.json");
    
    if !meta_path.exists() {
        return Err(BundleError::MissingFile("meta.json".to_string()));
    }
    
    let meta_content = fs::read_to_string(&meta_path)?;
    let meta: ProjectMeta = serde_json::from_str(&meta_content)?;
    
    Ok(meta)
}

/// Read markers from a bundle
pub fn read_markers(bundle_path: &Path) -> Result<Vec<Marker>, BundleError> {
    let markers_path = bundle_path.join("markers.json");
    
    if !markers_path.exists() {
        // Markers are optional, return empty vec if not present
        return Ok(Vec::new());
    }
    
    let markers_content = fs::read_to_string(&markers_path)?;
    let markers: Vec<Marker> = serde_json::from_str(&markers_content)?;
    
    Ok(markers)
}

/// Write a project to a bundle directory
pub fn write_project(project: &Project, bundle_path: &Path) -> Result<(), BundleError> {
    // Create bundle directory if it doesn't exist
    if !bundle_path.exists() {
        fs::create_dir_all(bundle_path)?;
    }
    
    // Create recording subdirectory
    let recording_path = bundle_path.join("recording");
    if !recording_path.exists() {
        fs::create_dir_all(&recording_path)?;
    }
    
    // Write project.json
    let project_content = serde_json::to_string_pretty(project)?;
    fs::write(bundle_path.join("project.json"), project_content)?;
    
    // Write or update meta.json
    let meta = ProjectMeta::default();
    let meta_content = serde_json::to_string_pretty(&meta)?;
    fs::write(bundle_path.join("meta.json"), meta_content)?;
    
    // Write empty markers.json if it doesn't exist
    let markers_path = bundle_path.join("markers.json");
    if !markers_path.exists() {
        fs::write(&markers_path, "[]")?;
    }
    
    tracing::debug!("Saved project '{}' to {:?}", project.name, bundle_path);
    
    Ok(())
}

/// Write markers to a bundle
pub fn write_markers(markers: &[Marker], bundle_path: &Path) -> Result<(), BundleError> {
    let markers_content = serde_json::to_string_pretty(markers)?;
    fs::write(bundle_path.join("markers.json"), markers_content)?;
    
    Ok(())
}

/// Check if a path is a valid project bundle
pub fn is_valid_bundle(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    
    // A valid bundle must have at least project.json
    path.join("project.json").exists()
}

/// Get the bundle extension
pub const BUNDLE_EXTENSION: &str = "osp";

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    #[test]
    fn test_create_and_read_project() {
        let dir = tempdir().unwrap();
        let bundle_path = dir.path().join("test.osp");
        
        // Create a project
        let project = Project::new("Test Project".to_string());
        
        // Write it
        write_project(&project, &bundle_path).unwrap();
        
        // Read it back
        let loaded = read_project(&bundle_path).unwrap();
        
        assert_eq!(loaded.name, "Test Project");
        assert_eq!(loaded.id, project.id);
    }
    
    #[test]
    fn test_is_valid_bundle() {
        let dir = tempdir().unwrap();
        
        // Empty directory is not valid
        let empty_path = dir.path().join("empty.osp");
        fs::create_dir_all(&empty_path).unwrap();
        assert!(!is_valid_bundle(&empty_path));
        
        // Directory with project.json is valid
        let valid_path = dir.path().join("valid.osp");
        fs::create_dir_all(&valid_path).unwrap();
        fs::write(valid_path.join("project.json"), "{}").unwrap();
        assert!(is_valid_bundle(&valid_path));
    }
}
