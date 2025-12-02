//! WASM bindings for zecscope-scanner.
//!
//! This crate provides WebAssembly bindings for the zecscope-scanner library,
//! allowing Zcash shielded transaction scanning directly in web browsers.

use wasm_bindgen::prelude::*;
use zecscope_scanner::{Scanner, ScanRequest, CompactBlock};

/// Scan compact blocks with a viewing key.
///
/// Takes a JSON request with:
/// - `viewing_key`: Unified Full Viewing Key (uview1...)
/// - `key_id`: Identifier for tracking which key found transactions
/// - `compact_blocks`: Array of compact blocks from lightwalletd
///
/// Returns JSON array of discovered transactions.
#[wasm_bindgen]
pub fn scan_compact_blocks(request_json: &str) -> Result<JsValue, JsValue> {
    // Parse the request
    let request: WasmScanRequest = serde_json::from_str(request_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid request JSON: {e}")))?;

    // Parse compact blocks from the nested JSON string
    let compact_blocks: Vec<CompactBlock> = serde_json::from_str(&request.compact_blocks_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid compact blocks JSON: {e}")))?;

    // Create the scanner request
    let scan_request = ScanRequest {
        viewing_key: request.viewing_key,
        key_id: request.key_id,
        compact_blocks,
    };

    // Create scanner for mainnet and scan
    let scanner = Scanner::mainnet();
    let transactions = scanner.scan(&scan_request)
        .map_err(|e| JsValue::from_str(&format!("Scan error: {e}")))?;

    // Serialize result to JSON
    let json = serde_json::to_string(&transactions)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {e}")))?;

    Ok(JsValue::from_str(&json))
}

/// Request format for WASM scanning.
/// 
/// Uses a nested JSON string for compact blocks to simplify
/// the JavaScript-to-WASM data marshalling.
#[derive(serde::Deserialize)]
struct WasmScanRequest {
    viewing_key: String,
    key_id: String,
    compact_blocks_json: String,
}

/// Get the version of the scanner.
#[wasm_bindgen]
pub fn scanner_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
