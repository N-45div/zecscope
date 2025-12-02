import React, { useEffect, useState } from 'react'
import { fetchChainInfo, fetchHealth, type ChainInfoResponse, fetchBlocks } from './api'
import { useKeysStore } from './state/keysStore'
import { useTransactionsStore } from './state/transactionsStore'
import { useAlertsStore } from './state/alertsStore'
import { buildAuditCsv, buildAuditSummary } from './audit'
import { scanWithViewingKey, mapBlocksForScanner } from './wasm/zcashScanner'

function App() {
  const [health, setHealth] = useState<string>('checking...')
  const [chainInfo, setChainInfo] = useState<ChainInfoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'active' | 'all'>('active')

  const { keys, activeKeyId, addKey, removeKey, setActiveKey } = useKeysStore()
  const { transactions, setTransactionsForKey } = useTransactionsStore()
  const { rules, alerts, checkTransactions, acknowledgeAlert, addRule, toggleRule, removeRule } = useAlertsStore()
  const [newKey, setNewKey] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const [healthRes, chainInfoRes] = await Promise.all([
          fetchHealth(),
          fetchChainInfo(),
        ])
        setHealth(healthRes.status)
        setChainInfo(chainInfoRes)
      } catch (err) {
        console.error(err)
        setError(
          'API not reachable yet. Ensure the zecscope-api server is running locally or deployed with a reachable URL.',
        )
      }
    }

    void init()
  }, [])

  function handleAddKey() {
    const trimmed = newKey.trim()
    if (!trimmed) return
    addKey(trimmed, newKeyLabel.trim() || undefined)
    setNewKey('')
    setNewKeyLabel('')
  }

  async function handleScanActiveKey() {
    if (!activeKeyId || !chainInfo) return

    const activeKey = keys.find((k) => k.id === activeKeyId)
    if (!activeKey) return

    setScanning(true)
    setError(null)
    setScanProgress('Fetching blocks...')
    try {
      const endHeight = chainInfo.height
      const startHeight = Math.max(endHeight - 1000, 0)

      const blocksRes = await fetchBlocks({ startHeight, endHeight })
      const compactBlocks = mapBlocksForScanner(blocksRes.blocks)

      setScanProgress(`Scanning ${compactBlocks.length} blocks...`)
      const txs = await scanWithViewingKey({
        viewingKey: activeKey.viewingKey,
        keyId: activeKey.id,
        compactBlocks,
      })

      setTransactionsForKey(activeKey.id, txs)
      
      // Check for alerts on new transactions
      const newAlerts = checkTransactions(txs)
      if (newAlerts.length > 0) {
        setScanProgress(`Found ${txs.length} tx, ${newAlerts.length} alert(s)!`)
      } else {
        setScanProgress(`Found ${txs.length} transaction(s)`)
      }
    } catch (err) {
      console.error(err)
      setError('Scanning failed. Please check the WASM scanner and backend blocks API.')
      setScanProgress('')
    } finally {
      setScanning(false)
    }
  }

  // Scan all keys (multi-key view)
  async function handleScanAllKeys() {
    if (keys.length === 0 || !chainInfo) return

    setScanning(true)
    setError(null)
    setScanProgress('Fetching blocks...')
    
    try {
      const endHeight = chainInfo.height
      const startHeight = Math.max(endHeight - 1000, 0)

      const blocksRes = await fetchBlocks({ startHeight, endHeight })
      const compactBlocks = mapBlocksForScanner(blocksRes.blocks)

      let totalTxs = 0
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        setScanProgress(`Scanning key ${i + 1}/${keys.length}: ${key.label || 'Unnamed'}...`)
        
        const txs = await scanWithViewingKey({
          viewingKey: key.viewingKey,
          keyId: key.id,
          compactBlocks,
        })

        setTransactionsForKey(key.id, txs)
        totalTxs += txs.length
        
        // Check for alerts
        checkTransactions(txs)
      }

      setScanProgress(`Scanned ${keys.length} keys, found ${totalTxs} transaction(s)`)
    } catch (err) {
      console.error(err)
      setError('Scanning failed. Please check the WASM scanner and backend blocks API.')
      setScanProgress('')
    } finally {
      setScanning(false)
    }
  }

  function handleDownloadAuditCsv() {
    if (keys.length === 0) return

    const summary = buildAuditSummary(keys, transactions)
    const csv = buildAuditCsv(summary)

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `zecscope-audit-${ts}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Computed values for analytics - supports both single key and multi-key view
  const displayTxs = viewMode === 'all' 
    ? transactions 
    : activeKeyId 
      ? transactions.filter((t) => t.keyId === activeKeyId)
      : []

  const totalReceivedZat = displayTxs
    .filter((t) => t.direction === 'in')
    .reduce((acc, t) => acc + Number(t.amountZat || 0), 0)

  const totalSentZat = displayTxs
    .filter((t) => t.direction === 'out')
    .reduce((acc, t) => acc + Number(t.amountZat || 0), 0)

  const netFlowZat = totalReceivedZat - totalSentZat

  // Pool breakdown
  const saplingTxs = displayTxs.filter((t) => t.pool === 'sapling')
  const orchardTxs = displayTxs.filter((t) => t.pool === 'orchard')

  // Unacknowledged alerts count
  const unackedAlerts = alerts.filter((a) => !a.acknowledged)

  const formatZec = (zat: number) =>
    (zat / 100_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    })

  const formatTime = (unixSecs: number) =>
    new Date(unixSecs * 1000).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="app-logo-dot" />
            <div>
              <h1 className="app-title">ZecScope</h1>
              <p className="app-tagline">Private shielded explorer &amp; analytics</p>
            </div>
          </div>
          <div className="app-header-meta">
            {chainInfo && (
              <span className="badge badge-accent">
                {chainInfo.network === 'zcash-mainnet' ? '🔶 Mainnet' : '🔷 Testnet'}
              </span>
            )}
            {chainInfo && (
              <span className="badge badge-primary">
                Block #{chainInfo.height.toLocaleString()}
              </span>
            )}
            <span className={`badge ${health === 'ok' ? 'badge-success' : ''}`}>
              <span className={`status-dot ${health === 'ok' ? 'online' : 'offline'}`} />
              API {health}
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-inner">
          {/* Hero Section */}
          <div className="hero-intro animate-in">
            <h2>🔒 Your Shielded Transactions, Your Insights</h2>
            <p>
              Connect Zcash viewing keys to unlock private analytics and audit reports.
              Everything runs locally in your browser — nothing sensitive ever leaves.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: 10,
                padding: '0.875rem 1.25rem',
                marginBottom: '1.5rem',
                color: '#f87171',
                fontSize: '0.875rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div className="dashboard-grid">
            {/* Left Column: Keys & Network */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Viewing Keys Card */}
              <div className="card animate-in">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">🔑 Viewing Keys</h2>
                    <p className="card-subtitle">
                      Add unified full viewing keys (UFVK) to scan shielded transaction history.
                    </p>
                  </div>
                  <span className="badge badge-primary">{keys.length} key{keys.length !== 1 ? 's' : ''}</span>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <input
                    type="text"
                    className="input"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="Label (e.g. Treasury, Grants, Personal)"
                  />
                  <textarea
                    className="textarea"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    rows={3}
                    placeholder="Paste your unified viewing key (uview1...)"
                  />
                  <button
                    type="button"
                    className="button button-accent"
                    onClick={handleAddKey}
                    disabled={!newKey.trim()}
                    style={{ opacity: newKey.trim() ? 1 : 0.5 }}
                  >
                    ➕ Add Viewing Key
                  </button>
                </div>

                {keys.length > 0 ? (
                  <div>
                    <div className="section-header">
                      <span className="section-title">Configured Keys</span>
                    </div>
                    <ul className="key-list">
                      {keys.map((k) => {
                        const isActive = k.id === activeKeyId
                        return (
                          <li key={k.id} className={`key-item ${isActive ? 'active' : ''}`}>
                            <div className="key-item-inner">
                              <div className="key-info">
                                <div className="key-label">
                                  {isActive && <span style={{ color: '#34d399', marginRight: 6 }}>●</span>}
                                  {k.label || 'Unnamed Key'}
                                </div>
                                <div className="key-address">
                                  {k.viewingKey.slice(0, 20)}...{k.viewingKey.slice(-10)}
                                </div>
                              </div>
                              <div className="key-actions">
                                {!isActive && (
                                  <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={() => setActiveKey(k.id)}
                                  >
                                    Set Active
                                  </button>
                                )}
                                {isActive && (
                                  <span className="badge badge-success">Active</span>
                                )}
                                <button
                                  type="button"
                                  className="button-danger"
                                  onClick={() => removeKey(k.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🔐</div>
                    <p className="empty-state-text">No viewing keys added yet.<br />Paste a UFVK above to get started.</p>
                  </div>
                )}
              </div>

              {/* Network Status Card */}
              <div className="card animate-in">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">📡 Network Status</h2>
                    <p className="card-subtitle">Lightwalletd connection and chain info.</p>
                  </div>
                </div>

                <div className="network-status">
                  <div className="network-status-item">
                    <span className="network-status-label">API Status</span>
                    <span className="network-status-value" style={{ color: health === 'ok' ? '#34d399' : '#f87171' }}>
                      {health === 'ok' ? '● Connected' : '○ ' + health}
                    </span>
                  </div>
                  {chainInfo && (
                    <>
                      <div className="network-status-item">
                        <span className="network-status-label">Network</span>
                        <span className="network-status-value">{chainInfo.network}</span>
                      </div>
                      <div className="network-status-item">
                        <span className="network-status-label">Current Height</span>
                        <span className="network-status-value">{chainInfo.height.toLocaleString()}</span>
                      </div>
                      <div className="network-status-item">
                        <span className="network-status-label">Sapling Activation</span>
                        <span className="network-status-value">{chainInfo.saplingActivationHeight.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {!chainInfo && !error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                      <div className="spinner" />
                      <span>Connecting to backend...</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Right Column: Analytics */}
            <section>
              {/* Alerts Banner */}
              {unackedAlerts.length > 0 && (
                <div className="alerts-banner" style={{
                  background: 'rgba(244, 183, 40, 0.1)',
                  border: '1px solid rgba(244, 183, 40, 0.3)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>🔔</span>
                    <span style={{ fontWeight: 600, color: 'var(--zcash-yellow)' }}>
                      {unackedAlerts.length} Alert{unackedAlerts.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      — {unackedAlerts[0]?.message}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => unackedAlerts.forEach((a) => acknowledgeAlert(a.id))}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                  >
                    Dismiss All
                  </button>
                </div>
              )}

              <div className="card animate-in">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">📊 Analytics Dashboard</h2>
                    <p className="card-subtitle">
                      {viewMode === 'all' 
                        ? `Combined view across ${keys.length} key${keys.length !== 1 ? 's' : ''}`
                        : 'Scan your viewing key to reveal shielded transaction history'
                      }
                      {scanProgress && <span style={{ color: 'var(--text-accent)' }}> — {scanProgress}</span>}
                    </p>
                  </div>
                </div>

                {/* View Mode Toggle + Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('active')}
                      style={{
                        padding: '0.5rem 0.875rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        background: viewMode === 'active' ? 'var(--bg-elevated)' : 'transparent',
                        color: viewMode === 'active' ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      Active Key
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('all')}
                      style={{
                        padding: '0.5rem 0.875rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        border: 'none',
                        borderLeft: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: viewMode === 'all' ? 'var(--bg-elevated)' : 'transparent',
                        color: viewMode === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      All Keys ({keys.length})
                    </button>
                  </div>

                  <div style={{ flex: 1 }} />

                  {viewMode === 'all' ? (
                    <button
                      type="button"
                      className="button button-accent"
                      onClick={handleScanAllKeys}
                      disabled={keys.length === 0 || scanning}
                    >
                      {scanning ? (
                        <>
                          <div className="spinner" />
                          {scanProgress || 'Scanning...'}
                        </>
                      ) : (
                        '🔍 Scan All Keys'
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button"
                      onClick={handleScanActiveKey}
                      disabled={!activeKeyId || scanning}
                    >
                      {scanning ? (
                        <>
                          <div className="spinner" />
                          {scanProgress || 'Scanning...'}
                        </>
                      ) : (
                        '🔍 Scan Blocks'
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={handleDownloadAuditCsv}
                    disabled={keys.length === 0}
                  >
                    📥 Export CSV
                  </button>
                </div>
                {/* Stats Cards */}
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-label">💰 Total Received</div>
                    <div className={`stat-value ${displayTxs.length && totalReceivedZat > 0 ? 'positive' : ''}`}>
                      {displayTxs.length ? formatZec(totalReceivedZat) + ' ZEC' : '—'}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">📤 Total Sent</div>
                    <div className={`stat-value ${displayTxs.length && totalSentZat > 0 ? 'negative' : ''}`}>
                      {displayTxs.length ? formatZec(totalSentZat) + ' ZEC' : '—'}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">📊 Net Flow</div>
                    <div className={`stat-value ${netFlowZat >= 0 ? 'positive' : 'negative'}`}>
                      {displayTxs.length ? (netFlowZat >= 0 ? '+' : '') + formatZec(netFlowZat) + ' ZEC' : '—'}
                    </div>
                  </div>
                </div>

                {/* Pool Breakdown */}
                {displayTxs.length > 0 && (
                  <div className="quick-stats" style={{ marginBottom: '1rem' }}>
                    <div className="quick-stat">
                      <span className="quick-stat-label">🌿 Sapling Transactions</span>
                      <span className="quick-stat-value">{saplingTxs.length}</span>
                    </div>
                    <div className="quick-stat">
                      <span className="quick-stat-label">🌸 Orchard Transactions</span>
                      <span className="quick-stat-value">{orchardTxs.length}</span>
                    </div>
                  </div>
                )}

                {/* Activity Chart */}
                {displayTxs.length > 0 ? (
                  <div className="chart-container">
                    <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                      <span className="section-title">📈 Activity Timeline</span>
                    </div>
                    <div className="activity-chart">
                      {(() => {
                        // Group transactions by day
                        const byDay = new Map<string, number>()
                        displayTxs.forEach((t) => {
                          const date = new Date(t.time * 1000).toISOString().split('T')[0]
                          const amt = Number(t.amountZat || 0)
                          byDay.set(date, (byDay.get(date) || 0) + (t.direction === 'in' ? amt : -amt))
                        })
                        
                        const entries = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
                        const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 1)
                        
                        return (
                          <div className="chart-bars">
                            {entries.map(([date, value]) => {
                              const height = Math.max(Math.abs(value) / maxAbs * 100, 5)
                              const isPositive = value >= 0
                              return (
                                <div key={date} className="chart-bar-wrapper" title={`${date}: ${(value / 100_000_000).toFixed(4)} ZEC`}>
                                  <div
                                    className={`chart-bar ${isPositive ? 'positive' : 'negative'}`}
                                    style={{ height: `${height}%` }}
                                  />
                                  <span className="chart-bar-label">{date.slice(5)}</span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="chart-shell">
                    <div className="chart-line" />
                    <span style={{ position: 'absolute', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Scan to see activity chart
                    </span>
                  </div>
                )}

                {/* Largest Transaction Highlight */}
                {displayTxs.length > 0 && (() => {
                  const largest = [...displayTxs].sort((a, b) => 
                    Number(b.amountZat || 0) - Number(a.amountZat || 0)
                  )[0]
                  if (!largest) return null
                  const amt = Number(largest.amountZat || 0)
                  return (
                    <div className="highlight-card">
                      <div className="highlight-icon">🏆</div>
                      <div className="highlight-content">
                        <div className="highlight-label">Largest Transaction</div>
                        <div className="highlight-value">
                          {formatZec(amt)} ZEC
                          <span className="highlight-meta">
                            {' '}• {formatTime(largest.time)} • Block {largest.height.toLocaleString()}
                          </span>
                        </div>
                        <div className="highlight-txid">{largest.txid}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Transactions Table */}
                <div style={{ marginTop: '1.25rem' }}>
                  <div className="section-header">
                    <span className="section-title">📜 Transaction History</span>
                    {displayTxs.length > 0 && (
                      <span className="badge" style={{ marginLeft: 'auto' }}>
                        {displayTxs.length} tx{displayTxs.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {(viewMode === 'all' || activeKeyId) ? (
                    displayTxs.length > 0 ? (
                      <div className="tx-table-wrapper">
                        <table className="tx-table">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Pool</th>
                              <th>Amount (ZEC)</th>
                              {viewMode === 'all' && <th>Key</th>}
                              <th>Transaction ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...displayTxs]
                              .sort((a, b) => b.height - a.height)
                              .map((t) => {
                                const keyLabel = keys.find((k) => k.id === t.keyId)?.label || 'Unknown'
                                return (
                                  <tr key={`${t.txid}-${t.height}-${t.keyId}`}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatTime(t.time)}</td>
                                    <td>
                                      <span className={`badge ${t.pool === 'orchard' ? 'badge-accent' : 'badge-primary'}`} style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}>
                                        {t.pool === 'orchard' ? '🌸' : '🌿'} {t.pool}
                                      </span>
                                    </td>
                                    <td className={`amount ${t.direction}`}>
                                      {t.direction === 'in' ? '+' : '-'}
                                      {formatZec(Number(t.amountZat || 0))}
                                    </td>
                                    {viewMode === 'all' && (
                                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {keyLabel}
                                      </td>
                                    )}
                                    <td className="txid">
                                      {t.txid.slice(0, 8)}...{t.txid.slice(-6)}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '1.5rem' }}>
                        <div className="empty-state-icon">🔍</div>
                        <p className="empty-state-text">
                          No transactions found in the last 1,000 blocks.<br />
                          Try scanning a wider range or check your viewing key.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="empty-state" style={{ padding: '1.5rem' }}>
                      <div className="empty-state-icon">👆</div>
                      <p className="empty-state-text">
                        Set an active viewing key and click "Scan Blocks"<br />
                        to reveal your shielded transaction history.
                      </p>
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div className="feature-list">
                  <div className="feature-item">Per-key and combined org analytics</div>
                  <div className="feature-item">One-click audit report export (JSON/CSV/PDF)</div>
                  <div className="feature-item">Alert rules for large or unusual movements</div>
                  <div className="feature-item">Privacy-preserving counterparty analysis</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '1.25rem 1.5rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
      }}>
        <p>
          🔒 <strong>ZecScope</strong> — Private Zcash shielded explorer & analytics.
          All scanning happens locally in your browser.
        </p>
        <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>
          Built for the Zcash ecosystem • Powered by Rust WASM
        </p>
      </footer>
    </div>
  )
}

export default App
