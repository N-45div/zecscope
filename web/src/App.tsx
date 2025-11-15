import React, { useEffect, useState } from 'react'
import { fetchChainInfo, fetchHealth, type ChainInfoResponse } from './api'

function App() {
  const [health, setHealth] = useState<string>('checking...')
  const [chainInfo, setChainInfo] = useState<ChainInfoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewingKey, setViewingKey] = useState('')

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
        setError('API not reachable yet. Make sure the zecscope-api server is running on port 4000.')
      }
    }

    void init()
  }, [])

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>ZecScope</h1>
        <p>Private Zcash shielded explorer & analytics (hackathon MVP scaffold).</p>
      </header>
      <main>
        <section>
          <h2>Backend status</h2>
          {error ? (
            <p style={{ color: '#f97373' }}>{error}</p>
          ) : (
            <>
              <p>Health: {health}</p>
              {chainInfo && (
                <p>
                  Network: {chainInfo.network} · Height: {chainInfo.height} · Sapling activation:{' '}
                  {chainInfo.saplingActivationHeight}
                </p>
              )}
            </>
          )}
        </section>

        <section style={{ marginTop: '2rem' }}>
          <h2>Viewing key (coming soon)</h2>
          <p>Paste your Zcash viewing key here. For now this is just UI; scan logic comes next.</p>
          <textarea
            value={viewingKey}
            onChange={(e) => setViewingKey(e.target.value)}
            rows={4}
            style={{ width: '100%', marginTop: '0.75rem' }}
            placeholder="uview1..."
          />
          <button
            type="button"
            style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', cursor: 'not-allowed', opacity: 0.5 }}
            disabled
          >
            Scan shielded history (WASM engine coming next)
          </button>
        </section>
      </main>
    </div>
  )
}

export default App
