import type { ViewingKeyProfile, ZecTransaction } from './types'

export interface AuditSummary {
  generatedAt: string
  keySummaries: {
    keyId: string
    label: string
    totalReceivedZat: string
    totalSentZat: string
    netZat: string
    txCount: number
  }[]
}

export function buildAuditSummary(
  keys: ViewingKeyProfile[],
  transactions: ZecTransaction[],
): AuditSummary {
  const perKey: AuditSummary['keySummaries'] = keys.map((k) => {
    const txs = transactions.filter((t) => t.keyId === k.id)
    let received = 0n
    let sent = 0n

    for (const tx of txs) {
      const value = BigInt(tx.amountZat)
      if (tx.direction === 'in') received += value
      else sent += value
    }

    return {
      keyId: k.id,
      label: k.label,
      totalReceivedZat: received.toString(),
      totalSentZat: sent.toString(),
      netZat: (received - sent).toString(),
      txCount: txs.length,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    keySummaries: perKey,
  }
}

export function buildAuditCsv(summary: AuditSummary): string {
  const header = 'keyLabel,keyId,totalReceivedZat,totalSentZat,netZat,txCount'
  const rows = summary.keySummaries.map((k) =>
    [k.label, k.keyId, k.totalReceivedZat, k.totalSentZat, k.netZat, k.txCount.toString()]
      .map((v) => JSON.stringify(v))
      .join(','),
  )
  return [header, ...rows].join('\n')
}
