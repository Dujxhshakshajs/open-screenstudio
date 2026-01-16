//! Error types and handling
//!
//! Common error types used across the application.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Application-wide error type
#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Project error: {0}")]
    Project(String),
    
    #[error("Recording error: {0}")]
    Recording(String),
    
    #[error("Export error: {0}")]
    Export(String),
    
    #[error("Platform error: {0}")]
    Platform(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

/// Error response for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
}

impl From<AppError> for ErrorResponse {
    fn from(error: AppError) -> Self {
        let code = match &error {
            AppError::Io(_) => "IO_ERROR",
            AppError::Serialization(_) => "SERIALIZATION_ERROR",
            AppError::Project(_) => "PROJECT_ERROR",
            AppError::Recording(_) => "RECORDING_ERROR",
            AppError::Export(_) => "EXPORT_ERROR",
            AppError::Platform(_) => "PLATFORM_ERROR",
            AppError::PermissionDenied(_) => "PERMISSION_DENIED",
        };
        
        ErrorResponse {
            code: code.to_string(),
            message: error.to_string(),
        }
    }
}

/// Result type alias using AppError
pub type AppResult<T> = Result<T, AppError>;
