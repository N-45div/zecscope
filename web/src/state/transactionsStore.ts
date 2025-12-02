import { create } from 'zustand'
import type { ZecTransaction } from '../types'

interface TransactionsState {
  transactions: ZecTransaction[]
  setTransactionsForKey: (keyId: string, txs: ZecTransaction[]) => void
  clearAll: () => void
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  setTransactionsForKey: (keyId, txs) => {
    set((state) => {
      const filtered = state.transactions.filter((t) => t.keyId !== keyId)
      return { transactions: [...filtered, ...txs] }
    })
  },
  clearAll: () => {
    const { transactions } = get()
    if (transactions.length === 0) return
    set({ transactions: [] })
  },
}))
