export type TxDirection = 'in' | 'out'
export type ShieldedPool = 'sapling' | 'orchard'

export interface ViewingKeyProfile {
  id: string
  label: string
  viewingKey: string
  createdAt: number
}

export interface ZecTransaction {
  txid: string
  height: number
  time: number // unix timestamp (seconds)
  amountZat: string
  direction: TxDirection
  memo?: string
  keyId: string // which viewing key this tx is associated with
  pool: ShieldedPool // which shielded pool: sapling or orchard
}

export interface AlertRule {
  id: string
  name: string
  type: 'large_tx' | 'daily_volume' | 'new_counterparty'
  threshold: number // in zatoshis for amount-based rules
  enabled: boolean
  createdAt: number
}

export interface Alert {
  id: string
  ruleId: string
  txid?: string
  message: string
  timestamp: number
  acknowledged: boolean
}
