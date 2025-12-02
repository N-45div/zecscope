import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AlertRule, Alert, ZecTransaction } from '../types'

interface AlertsState {
  rules: AlertRule[]
  alerts: Alert[]
  addRule: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => void
  removeRule: (id: string) => void
  toggleRule: (id: string) => void
  updateRule: (id: string, updates: Partial<AlertRule>) => void
  checkTransactions: (txs: ZecTransaction[]) => Alert[]
  acknowledgeAlert: (id: string) => void
  clearAlerts: () => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      rules: [
        // Default rule: alert on transactions > 1 ZEC
        {
          id: 'default-large-tx',
          name: 'Large Transaction (> 1 ZEC)',
          type: 'large_tx',
          threshold: 100_000_000, // 1 ZEC in zatoshis
          enabled: true,
          createdAt: Date.now(),
        },
      ],
      alerts: [],

      addRule: (rule) => {
        const newRule: AlertRule = {
          ...rule,
          id: generateId(),
          createdAt: Date.now(),
        }
        set((state) => ({ rules: [...state.rules, newRule] }))
      },

      removeRule: (id) => {
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
          alerts: state.alerts.filter((a) => a.ruleId !== id),
        }))
      },

      toggleRule: (id) => {
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
          ),
        }))
      },

      updateRule: (id, updates) => {
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))
      },

      checkTransactions: (txs) => {
        const { rules, alerts } = get()
        const newAlerts: Alert[] = []
        const existingTxids = new Set(alerts.map((a) => a.txid))

        for (const tx of txs) {
          // Skip if we already have an alert for this tx
          if (existingTxids.has(tx.txid)) continue

          for (const rule of rules) {
            if (!rule.enabled) continue

            let triggered = false
            let message = ''

            switch (rule.type) {
              case 'large_tx': {
                const amount = Number(tx.amountZat || 0)
                if (amount >= rule.threshold) {
                  triggered = true
                  const zec = (amount / 100_000_000).toFixed(4)
                  message = `Large ${tx.direction === 'in' ? 'incoming' : 'outgoing'} transaction: ${zec} ZEC (${tx.pool})`
                }
                break
              }
              // Add more rule types here
            }

            if (triggered) {
              newAlerts.push({
                id: generateId(),
                ruleId: rule.id,
                txid: tx.txid,
                message,
                timestamp: Date.now(),
                acknowledged: false,
              })
            }
          }
        }

        if (newAlerts.length > 0) {
          set((state) => ({ alerts: [...newAlerts, ...state.alerts] }))
        }

        return newAlerts
      },

      acknowledgeAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, acknowledged: true } : a
          ),
        }))
      },

      clearAlerts: () => {
        set({ alerts: [] })
      },
    }),
    {
      name: 'zecscope-alerts',
    }
  )
)
