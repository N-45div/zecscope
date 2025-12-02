//! # zecscope-scanner
//!
//! High-level Zcash shielded transaction scanner for viewing keys.
//!
//! This crate provides a simple API to scan Zcash compact blocks using
//! Unified Full Viewing Keys (UFVKs) and discover incoming shielded transactions
//! in both the Sapling and Orchard pools.
//!
//! ## Features
//!
//! - **Simple API**: Just provide a UFVK and compact blocks, get transactions
//! - **Sapling + Orchard**: Scans both shielded pools (Orchard requires `orchard` feature)
//! - **WASM-compatible**: Use in browsers via WebAssembly (enable `wasm` feature)
//! - **Serde support**: All types serialize/deserialize for easy JSON interop
//!
//! ## Example
//!
//! ```rust,ignore
//! use zecscope_scanner::{Scanner, ScanRequest, Network};
//!
//! // Create a scanner for mainnet
//! let scanner = Scanner::new(Network::Mainnet);
//!
//! // Scan blocks with a viewing key
//! let request = ScanRequest {
//!     viewing_key: "uview1...".to_string(),
//!     key_id: "my-wallet".to_string(),
//!     compact_blocks: blocks, // Vec<CompactBlock>
//! };
//!
//! let transactions = scanner.scan(&request)?;
//!
//! for tx in transactions {
//!     println!("{}: {} ZEC ({})", tx.txid, tx.amount_zec(), tx.pool);
//! }
//! ```

mod error;
mod scanner;
mod types;

pub use error::{ScanError, ScanResult};
pub use scanner::Scanner;
pub use types::*;

// Re-export useful types from zcash crates
pub use zcash_protocol::consensus::Network;
