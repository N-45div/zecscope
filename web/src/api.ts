export type HealthResponse = {
  status: string
}

export type ChainInfoResponse = {
  network: string
  height: number
  saplingActivationHeight: number
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
