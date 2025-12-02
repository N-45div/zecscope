//! Error types for the scanner.

use thiserror::Error;

/// Result type alias for scanner operations.
pub type ScanResult<T> = Result<T, ScanError>;

/// Errors that can occur during scanning.
#[derive(Error, Debug)]
pub enum ScanError {
    /// Failed to decode the viewing key.
    #[error("Invalid viewing key: {0}")]
    InvalidViewingKey(String),

    /// Failed to parse compact block data.
    #[error("Invalid compact block at height {height}: {message}")]
    InvalidCompactBlock { height: u64, message: String },

    /// Failed to decode hex string.
    #[error("Invalid hex in {field}: {message}")]
    InvalidHex { field: String, message: String },

    /// Error during block scanning.
    #[error("Scan error at height {height}: {message}")]
    ScanFailed { height: u32, message: String },

    /// JSON serialization/deserialization error.
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}
