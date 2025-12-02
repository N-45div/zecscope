# zecscope-scanner

[![Crates.io](https://img.shields.io/crates/v/zecscope-scanner.svg)](https://crates.io/crates/zecscope-scanner)
[![Documentation](https://docs.rs/zecscope-scanner/badge.svg)](https://docs.rs/zecscope-scanner)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> High-level Zcash shielded transaction scanner for viewing keys.

Scan Zcash compact blocks with Unified Full Viewing Keys (UFVKs) to discover incoming shielded transactions in both the **Sapling** and **Orchard** pools.

## Features

- 🔑 **Simple API** — Just provide a UFVK and compact blocks, get transactions
- 🌿 **Sapling support** — Scan Sapling shielded pool transactions
- 🌸 **Orchard support** — Scan Orchard shielded pool transactions (NU5+)
- 🌐 **WASM-compatible** — Use in browsers via WebAssembly
- 📦 **Serde support** — All types serialize/deserialize for easy JSON interop
- 🔒 **Privacy-first** — Your viewing key stays local, only compact blocks needed

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
zecscope-scanner = "0.1"
```

### Feature Flags

| Feature | Default | Description |
|---------|---------|-------------|
| `sapling` | ✅ | Enable Sapling pool scanning |
| `orchard` | ✅ | Enable Orchard pool scanning |
| `wasm` | ❌ | Enable WASM compatibility |

## Usage

### Basic Example

```rust
use zecscope_scanner::{Scanner, ScanRequest, CompactBlock};

// Create a scanner for mainnet
let scanner = Scanner::mainnet();

// Your viewing key (from a wallet like Zashi or Ywallet)
let viewing_key = "uview1...";

// Compact blocks from lightwalletd
let blocks: Vec<CompactBlock> = fetch_blocks_from_lightwalletd();

// Create scan request
let request = ScanRequest {
    viewing_key: viewing_key.to_string(),
    key_id: "my-wallet".to_string(),
    compact_blocks: blocks,
};

// Scan!
let transactions = scanner.scan(&request)?;

for tx in &transactions {
    println!(
        "{} {} ZEC at height {} ({})",
        if tx.direction == TxDirection::In { "Received" } else { "Sent" },
        tx.amount_zec(),
        tx.height,
        tx.pool
    );
}
```

### JSON API (for WASM/FFI)

```rust
use zecscope_scanner::Scanner;

let scanner = Scanner::mainnet();

// JSON request
let request_json = r#"{
    "viewing_key": "uview1...",
    "key_id": "my-wallet",
    "compact_blocks": [...]
}"#;

// Returns JSON array of transactions
let result_json = scanner.scan_json(request_json)?;
```

### WASM Usage

Enable the `wasm` feature:

```toml
[dependencies]
zecscope-scanner = { version = "0.1", features = ["wasm"] }
```

Then compile with `wasm-pack`:

```bash
wasm-pack build --target web
```

## Types

### ZecTransaction

```rust
pub struct ZecTransaction {
    pub txid: String,           // Transaction ID (hex)
    pub height: u64,            // Block height
    pub time: i64,              // Unix timestamp
    pub amount_zat: String,     // Amount in zatoshis
    pub direction: TxDirection, // In or Out
    pub memo: Option<String>,   // Decoded memo (if available)
    pub key_id: String,         // Which key found this tx
    pub pool: ShieldedPool,     // Sapling or Orchard
}
```

### CompactBlock

Matches the lightwalletd compact block format. See [types.rs](src/types.rs) for full definitions.

## How It Works

This crate wraps the official `zcash_client_backend::scanning::scan_block` function with a simpler, more ergonomic API:

1. **Decode UFVK** — Parse the Unified Full Viewing Key
2. **Convert blocks** — Transform JSON/serde blocks to protobuf format
3. **Scan** — Use official Zcash scanning logic to find transactions
4. **Return** — Provide clean transaction records with pool info

### Privacy Guarantees

- Your viewing key is only used locally for decryption
- Compact blocks contain only commitments, not full transaction data
- No network requests are made by this crate

## Compatibility

| Zcash Crate | Version |
|-------------|---------|
| `zcash_client_backend` | 0.21.0 |
| `zcash_primitives` | 0.26.0 |
| `zcash_protocol` | 0.7 |
| `zcash_keys` | 0.12.0 |

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for the Zcash ecosystem.
