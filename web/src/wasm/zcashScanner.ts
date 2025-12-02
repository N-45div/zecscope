import type { ZecTransaction } from '../types'

// Shape of the request we will send into the WASM scanner.
// `compactBlocks` should contain the JSON objects returned from /api/blocks
// (or a transformed subset of those) for the given viewing key.
export interface ScanRequest {
  viewingKey: string
  keyId: string
  compactBlocks: unknown[]
}

type BufferJson = { type: string; data: number[] }

function bufferJsonToHex(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const arr = value as number[]
    return arr.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('')
  }

  if (typeof value === 'object') {
    const v = value as BufferJson
    if (Array.isArray(v.data)) {
      return v.data.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('')
    }
  }

  throw new Error('Unsupported buffer JSON for bytes field')
}

export interface ScannerChainMetadata {
  saplingCommitmentTreeSize: number
  orchardCommitmentTreeSize?: number
}

export interface ScannerCompactSaplingSpend {
  nf: string
}

export interface ScannerCompactSaplingOutput {
  cmu: string
  ephemeralKey: string
  ciphertext: string
}

export interface ScannerCompactOrchardAction {
  nf: string
  cmx: string
  ephemeralKey: string
  ciphertext: string
}

export interface ScannerCompactTx {
  index: number
  txid: string
  fee?: number
  spends: ScannerCompactSaplingSpend[]
  outputs: ScannerCompactSaplingOutput[]
  actions: ScannerCompactOrchardAction[]
}

export interface ScannerCompactBlock {
  protoVersion: number
  height: number
  hash: string
  prevHash: string
  time: number
  vtx: ScannerCompactTx[]
  chainMetadata?: ScannerChainMetadata
}

export function mapBlocksForScanner(rawBlocks: unknown[]): ScannerCompactBlock[] {
  return (rawBlocks as any[]).map((b) => ({
    protoVersion: Number(b.protoVersion ?? 0),
    height: Number(b.height ?? 0),
    hash: bufferJsonToHex(b.hash),
    prevHash: bufferJsonToHex(b.prevHash),
    time: Number(b.time ?? 0),
    vtx: (b.vtx ?? []).map((tx: any) => ({
      index: Number(tx.index ?? 0),
      txid: bufferJsonToHex(tx.txid ?? tx.hash),
      fee: typeof tx.fee === 'number' ? tx.fee : undefined,
      spends: (tx.spends ?? []).map((s: any) => ({
        nf: bufferJsonToHex(s.nf),
      })),
      outputs: (tx.outputs ?? []).map((o: any) => ({
        cmu: bufferJsonToHex(o.cmu),
        ephemeralKey: bufferJsonToHex(o.ephemeralKey),
        ciphertext: bufferJsonToHex(o.ciphertext),
      })),
      // Orchard actions (NU5+)
      actions: (tx.actions ?? []).map((a: any) => ({
        nf: bufferJsonToHex(a.nullifier ?? a.nf),
        cmx: bufferJsonToHex(a.cmx),
        ephemeralKey: bufferJsonToHex(a.ephemeralKey),
        ciphertext: bufferJsonToHex(a.ciphertext),
      })),
    })),
    chainMetadata: b.chainMetadata
      ? {
          saplingCommitmentTreeSize: Number(b.chainMetadata.saplingCommitmentTreeSize ?? 0),
          orchardCommitmentTreeSize:
            b.chainMetadata.orchardCommitmentTreeSize != null
              ? Number(b.chainMetadata.orchardCommitmentTreeSize)
              : undefined,
        }
      : undefined,
  }))
}

function normalizeViewingKey(raw: string): string {
  const trimmed = raw.trim()
  const pipeIndex = trimmed.indexOf('|')
  if (pipeIndex >= 0) {
    return trimmed.slice(0, pipeIndex)
  }
  return trimmed
}

// This is a placeholder implementation that just returns an empty
// transaction list. Once the Rust WASM module is built and bundled,
// we will replace this with a dynamic import of the generated
// `scan_compact_blocks` function and pass the serialized request.
export async function scanWithViewingKey(req: ScanRequest): Promise<ZecTransaction[]> {
  const wasm = await import('zcash-wasm')
  const requestPayload = {
    viewing_key: normalizeViewingKey(req.viewingKey),
    key_id: req.keyId,
    compact_blocks_json: JSON.stringify(req.compactBlocks),
  }
  const raw = wasm.scan_compact_blocks(JSON.stringify(requestPayload)) as unknown

  if (typeof raw === 'string') {
    return JSON.parse(raw) as ZecTransaction[]
  }

  if (Array.isArray(raw)) {
    return raw as ZecTransaction[]
  }

  return JSON.parse(String(raw)) as ZecTransaction[]
}
