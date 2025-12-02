export type HealthResponse = {
  status: string
}

export type ChainInfoResponse = {
  network: string
  height: number
  saplingActivationHeight: number
}

export type BlocksResponse = {
  startHeight: number
  endHeight: number
  count: number
  blocks: unknown[]
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchHealth() {
  return getJson<HealthResponse>('/api/health')
}

export async function fetchChainInfo() {
  return getJson<ChainInfoResponse>('/api/chain-info')
}

export async function fetchBlocks(params?: { startHeight?: number; endHeight?: number }) {
  const qs = new URLSearchParams()
  if (params?.startHeight != null) qs.set('startHeight', String(params.startHeight))
  if (params?.endHeight != null) qs.set('endHeight', String(params.endHeight))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return getJson<BlocksResponse>(`/api/blocks${suffix}`)
}
