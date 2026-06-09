import { db } from '../db/lowdb.js'
import type { HistoryEntry } from '@shared/types.js'

export function getHistoryByRecordId(recordId: string): HistoryEntry[] {
  return db.data.history
    .filter((h) => h.recordId === recordId)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}

export function addHistoryEntry(entry: HistoryEntry): void {
  db.data.history.push(entry)
}
