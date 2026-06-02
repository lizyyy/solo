import { create } from 'zustand'
import type { OperationLog } from '@/types'
import { getDB, generateId, nowISO } from '@/services/db'

interface OperationLogState {
  logs: OperationLog[]
  loadAll: () => Promise<void>
  addLog: (log: Omit<OperationLog, 'id' | 'operatedAt'>) => Promise<void>
}

export const useOperationLogStore = create<OperationLogState>((set) => ({
  logs: [],

  loadAll: async () => {
    const db = await getDB()
    const logs = await db.getAll('operationLogs')
    set({ logs })
  },

  addLog: async (log) => {
    const db = await getDB()
    const record: OperationLog = { ...log, id: generateId(), operatedAt: nowISO() }
    await db.put('operationLogs', record)
    set((state) => ({ logs: [...state.logs, record] }))
  },
}))
