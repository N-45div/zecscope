//! Types for scanner input/output.

use serde::{Deserialize, Serialize};

/// Which shielded pool a transaction belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShieldedPool {
    /// Sapling shielded pool (activated at Sapling upgrade)
    Sapling,
    /// Orchard shielded pool (activated at NU5)
    Orchard,
}

impl std::fmt::Display for ShieldedPool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ShieldedPool::Sapling => write!(f, "sapling"),
            ShieldedPool::Orchard => write!(f, "orchard"),
        }
    }
}

/// Direction of a transaction relative to the viewing key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TxDirection {
    /// Incoming transaction (received funds)
    In,
    /// Outgoing transaction (sent funds)
    Out,
}

/// A discovered shielded transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZecTransaction {
    /// Transaction ID (hex-encoded)
    pub txid: String,
    /// Block height where this transaction was mined
    pub height: u64,
    /// Block timestamp (Unix seconds)
    pub time: i64,
    /// Amount in zatoshis (as string to avoid precision loss)
    pub amount_zat: String,
    /// Direction relative to the viewing key
    pub direction: TxDirection,
    /// Decoded memo (if available and valid UTF-8)
    pub memo: Option<String>,
    /// ID of the viewing key that discovered this transaction
    pub key_id: String,
    /// Which shielded pool this transaction is in
    pub pool: ShieldedPool,
}

impl ZecTransaction {
    /// Get the amount in ZEC (floating point).
    pub fn amount_zec(&self) -> f64 {
        self.amount_zat
            .parse::<i64>()
            .map(|z| z as f64 / 100_000_000.0)
            .unwrap_or(0.0)
    }

    /// Get the amount in zatoshis.
    pub fn amount_zatoshis(&self) -> i64 {
        self.amount_zat.parse().unwrap_or(0)
    }
}

/// Request to scan compact blocks with a viewing key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRequest {
    /// Unified Full Viewing Key (uview1...)
    pub viewing_key: String,
    /// Identifier for this key (for tracking which key found which tx)
    pub key_id: String,
    /// Compact blocks to scan
    pub compact_blocks: Vec<CompactBlock>,
}

/// A compact block from lightwalletd.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactBlock {
    /// Protocol version
    pub proto_version: u32,
    /// Block height
    pub height: u64,
    /// Block hash (hex-encoded)
    pub hash: String,
    /// Previous block hash (hex-encoded)
    pub prev_hash: String,
    /// Block timestamp (Unix seconds)
    pub time: u32,
    /// Transactions in this block
    #[serde(default)]
    pub vtx: Vec<CompactTx>,
    /// Chain metadata (commitment tree sizes)
    #[serde(default)]
    pub chain_metadata: Option<ChainMetadata>,
}

/// A compact transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactTx {
    /// Transaction index in block
    pub index: u64,
    /// Transaction ID (hex-encoded)
    pub txid: String,
    /// Transaction fee (optional)
    #[serde(default)]
    pub fee: Option<u32>,
    /// Sapling spends
    #[serde(default)]
    pub spends: Vec<CompactSaplingSpend>,
    /// Sapling outputs
    #[serde(default)]
    pub outputs: Vec<CompactSaplingOutput>,
    /// Orchard actions
    #[serde(default)]
    pub actions: Vec<CompactOrchardAction>,
}

/// A compact Sapling spend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactSaplingSpend {
    /// Nullifier (hex-encoded)
    pub nf: String,
}

/// A compact Sapling output.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactSaplingOutput {
    /// Note commitment (hex-encoded)
    pub cmu: String,
    /// Ephemeral key (hex-encoded)
    pub ephemeral_key: String,
    /// Encrypted ciphertext (hex-encoded, first 52 bytes)
    pub ciphertext: String,
}

/// A compact Orchard action.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactOrchardAction {
    /// Nullifier (hex-encoded)
    pub nf: String,
    /// Note commitment (hex-encoded)
    pub cmx: String,
    /// Ephemeral key (hex-encoded)
    pub ephemeral_key: String,
    /// Encrypted ciphertext (hex-encoded, first 52 bytes)
    pub ciphertext: String,
}

/// Chain metadata from compact blocks.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainMetadata {
    /// Sapling commitment tree size at this block
    pub sapling_commitment_tree_size: u32,
    /// Orchard commitment tree size at this block (if applicable)
    #[serde(default)]
    pub orchard_commitment_tree_size: Option<u32>,
}

/// Result of scanning a range of blocks.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    /// Discovered transactions
    pub transactions: Vec<ZecTransaction>,
    /// Number of blocks scanned
    pub blocks_scanned: usize,
    /// Start height
    pub start_height: u64,
    /// End height
    pub end_height: u64,
    /// Sapling transactions found
    pub sapling_count: usize,
    /// Orchard transactions found
    pub orchard_count: usize,
}

impl ScanSummary {
    /// Create a new scan summary from transactions.
    pub fn from_transactions(txs: Vec<ZecTransaction>, start: u64, end: u64) -> Self {
        let sapling_count = txs.iter().filter(|t| t.pool == ShieldedPool::Sapling).count();
        let orchard_count = txs.iter().filter(|t| t.pool == ShieldedPool::Orchard).count();
        Self {
            blocks_scanned: (end - start + 1) as usize,
            start_height: start,
            end_height: end,
            sapling_count,
            orchard_count,
            transactions: txs,
        }
    }
}
