//! Core scanner implementation.

use crate::error::{ScanError, ScanResult};
use crate::types::*;
use zcash_client_backend::{
    data_api::BlockMetadata,
    proto::compact_formats,
    scanning::{scan_block, Nullifiers, ScanningKeys},
};
use zcash_keys::keys::UnifiedFullViewingKey;
use zcash_protocol::consensus::Network;
use zip32::Scope;

/// High-level scanner for Zcash shielded transactions.
///
/// The scanner takes compact blocks and a viewing key, and returns
/// all transactions visible to that key.
pub struct Scanner {
    network: Network,
}

impl Scanner {
    /// Create a new scanner for the given network.
    pub fn new(network: Network) -> Self {
        Self { network }
    }

    /// Create a scanner for mainnet.
    pub fn mainnet() -> Self {
        Self::new(Network::MainNetwork)
    }

    /// Create a scanner for testnet.
    pub fn testnet() -> Self {
        Self::new(Network::TestNetwork)
    }

    /// Scan compact blocks with a viewing key.
    ///
    /// Returns all transactions visible to the viewing key in the given blocks.
    pub fn scan(&self, request: &ScanRequest) -> ScanResult<Vec<ZecTransaction>> {
        // Normalize viewing key (strip any |uivk... suffix)
        let viewing_key = normalize_viewing_key(&request.viewing_key);

        // Decode the UFVK
        let ufvk = UnifiedFullViewingKey::decode(&self.network, &viewing_key)
            .map_err(|e| ScanError::InvalidViewingKey(e.to_string()))?;

        // Convert compact blocks to protobuf format
        let blocks = request
            .compact_blocks
            .iter()
            .map(|b| map_compact_block(b))
            .collect::<ScanResult<Vec<_>>>()?;

        // Set up scanning keys
        type AccountId = u32;
        let scanning_keys: ScanningKeys<AccountId, (AccountId, Scope)> =
            ScanningKeys::from_account_ufvks(std::iter::once((0u32, ufvk)));
        let nullifiers = Nullifiers::<AccountId>::empty();

        let mut prior_meta: Option<BlockMetadata> = None;
        let mut transactions = Vec::new();

        for block in blocks {
            let scanned = scan_block(
                &self.network,
                block,
                &scanning_keys,
                &nullifiers,
                prior_meta.as_ref(),
            )
            .map_err(|e| ScanError::ScanFailed {
                height: e.at_height().into(),
                message: e.to_string(),
            })?;

            let height: u32 = scanned.height().into();
            let height = height as u64;
            let time = scanned.block_time() as i64;

            for wtx in scanned.transactions() {
                let txid = wtx.txid();
                let txid_hex = hex::encode(txid.as_ref());

                // Process Sapling outputs
                for out in wtx.sapling_outputs() {
                    if out.is_change() {
                        continue;
                    }
                    let note = out.note();
                    let v = note.value().inner();
                    if v == 0 {
                        continue;
                    }

                    transactions.push(ZecTransaction {
                        txid: txid_hex.clone(),
                        height,
                        time,
                        amount_zat: v.to_string(),
                        direction: TxDirection::In,
                        memo: None,
                        key_id: request.key_id.clone(),
                        pool: ShieldedPool::Sapling,
                    });
                }

                // Process Orchard outputs
                #[cfg(feature = "orchard")]
                for out in wtx.orchard_outputs() {
                    if out.is_change() {
                        continue;
                    }
                    let note = out.note();
                    let v: u64 = note.value().inner();
                    if v == 0 {
                        continue;
                    }

                    transactions.push(ZecTransaction {
                        txid: txid_hex.clone(),
                        height,
                        time,
                        amount_zat: v.to_string(),
                        direction: TxDirection::In,
                        memo: None,
                        key_id: request.key_id.clone(),
                        pool: ShieldedPool::Orchard,
                    });
                }
            }

            prior_meta = Some(scanned.to_block_metadata());
        }

        Ok(transactions)
    }

    /// Scan compact blocks from JSON string.
    ///
    /// This is a convenience method for WASM and other environments
    /// where JSON is the primary data format.
    pub fn scan_json(&self, request_json: &str) -> ScanResult<String> {
        let request: ScanRequest = serde_json::from_str(request_json)?;
        let transactions = self.scan(&request)?;
        Ok(serde_json::to_string(&transactions)?)
    }
}

/// Normalize a viewing key string.
///
/// Some tools export UFVKs with an appended `|uivk...` segment.
/// This function strips that suffix to get just the UFVK.
fn normalize_viewing_key(raw: &str) -> String {
    let trimmed = raw.trim();
    if let Some(idx) = trimmed.find('|') {
        trimmed[..idx].to_string()
    } else {
        trimmed.to_string()
    }
}

/// Decode a hex string, returning a descriptive error.
fn decode_hex(s: &str, field: &str) -> ScanResult<Vec<u8>> {
    hex::decode(s).map_err(|e| ScanError::InvalidHex {
        field: field.to_string(),
        message: e.to_string(),
    })
}

/// Convert our CompactBlock type to the protobuf format.
fn map_compact_block(block: &CompactBlock) -> ScanResult<compact_formats::CompactBlock> {
    let vtx = block
        .vtx
        .iter()
        .map(map_compact_tx)
        .collect::<ScanResult<Vec<_>>>()?;

    let chain_metadata = block.chain_metadata.as_ref().map(|m| {
        compact_formats::ChainMetadata {
            sapling_commitment_tree_size: m.sapling_commitment_tree_size,
            orchard_commitment_tree_size: m.orchard_commitment_tree_size.unwrap_or(0),
        }
    });

    Ok(compact_formats::CompactBlock {
        proto_version: block.proto_version,
        height: block.height,
        hash: decode_hex(&block.hash, "block hash")?,
        prev_hash: decode_hex(&block.prev_hash, "block prevHash")?,
        time: block.time,
        header: Vec::new(),
        vtx,
        chain_metadata,
    })
}

/// Convert our CompactTx type to the protobuf format.
fn map_compact_tx(tx: &CompactTx) -> ScanResult<compact_formats::CompactTx> {
    let hash = decode_hex(&tx.txid, "txid")?;

    let spends = tx
        .spends
        .iter()
        .map(|s| {
            Ok(compact_formats::CompactSaplingSpend {
                nf: decode_hex(&s.nf, "sapling spend nf")?,
            })
        })
        .collect::<ScanResult<Vec<_>>>()?;

    let outputs = tx
        .outputs
        .iter()
        .map(|o| {
            Ok(compact_formats::CompactSaplingOutput {
                cmu: decode_hex(&o.cmu, "sapling output cmu")?,
                ephemeral_key: decode_hex(&o.ephemeral_key, "sapling output ephemeralKey")?,
                ciphertext: decode_hex(&o.ciphertext, "sapling output ciphertext")?,
            })
        })
        .collect::<ScanResult<Vec<_>>>()?;

    let actions = tx
        .actions
        .iter()
        .map(|a| {
            Ok(compact_formats::CompactOrchardAction {
                nullifier: decode_hex(&a.nf, "orchard action nf")?,
                cmx: decode_hex(&a.cmx, "orchard action cmx")?,
                ephemeral_key: decode_hex(&a.ephemeral_key, "orchard action ephemeralKey")?,
                ciphertext: decode_hex(&a.ciphertext, "orchard action ciphertext")?,
            })
        })
        .collect::<ScanResult<Vec<_>>>()?;

    Ok(compact_formats::CompactTx {
        index: tx.index,
        hash,
        fee: tx.fee.unwrap_or(0),
        spends,
        outputs,
        actions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_viewing_key() {
        // Normal UFVK
        assert_eq!(
            normalize_viewing_key("uview1abc123"),
            "uview1abc123"
        );

        // UFVK with UIVK suffix
        assert_eq!(
            normalize_viewing_key("uview1abc123|uivk1xyz789"),
            "uview1abc123"
        );

        // With whitespace
        assert_eq!(
            normalize_viewing_key("  uview1abc123  "),
            "uview1abc123"
        );
    }
}
