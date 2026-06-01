import { create } from "zustand"
import type { AuditLogEntry } from "@/types"

interface AuditStore {
  entries: AuditLogEntry[]
  addEntry: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void
}

let auditCounter = 0

export const useAuditStore = create<AuditStore>((set) => ({
  entries: [],

  addEntry: (entry) => {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${++auditCounter}`,
      timestamp: new Date().toLocaleString("zh-CN"),
    }
    set((state) => ({ entries: [...state.entries, newEntry] }))
  },
}))
