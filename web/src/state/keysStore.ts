import { create } from 'zustand'
import type { ViewingKeyProfile } from '../types'

interface KeysState {
  keys: ViewingKeyProfile[]
  activeKeyId: string | null
  addKey: (viewingKey: string, label?: string) => void
  removeKey: (id: string) => void
  setActiveKey: (id: string) => void
}

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}`
}

export const useKeysStore = create<KeysState>((set, get) => ({
  keys: [],
  activeKeyId: null,
  addKey: (viewingKey, label) => {
    const id = generateId('vk')
    set((state) => ({
      keys: [
        ...state.keys,
        {
          id,
          label: label || `Key ${state.keys.length + 1}`,
          viewingKey,
          createdAt: Date.now(),
        },
      ],
      activeKeyId: id,
    }))
  },
  removeKey: (id) => {
    set((state) => {
      const nextKeys = state.keys.filter((k) => k.id !== id)
      const nextActive = state.activeKeyId === id ? nextKeys[0]?.id ?? null : state.activeKeyId
      return {
        keys: nextKeys,
        activeKeyId: nextActive,
      }
    })
  },
  setActiveKey: (id) => {
    const { keys } = get()
    if (!keys.find((k) => k.id === id)) return
    set({ activeKeyId: id })
  },
}))
