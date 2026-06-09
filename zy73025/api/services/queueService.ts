import { db, newId } from '../db/lowdb.js'
import type {
  ExceptionItem,
  ExceptionType,
  HistoryEntry,
} from '@shared/types.js'
import { addHistoryEntry } from './historyService.js'

export function listQueue(type?: ExceptionType): ExceptionItem[] {
  if (!type) {
    return [...db.data.queue]
  }
  return db.data.queue.filter((q) => q.type === type)
}

export function getQueueItem(id: string): ExceptionItem | undefined {
  return db.data.queue.find((q) => q.id === id)
}

export async function ackException(
  id: string,
  note: string,
  operator: string,
): Promise<ExceptionItem | null> {
  const item = db.data.queue.find((q) => q.id === id)
  if (!item) {
    return null
  }

  const now = new Date().toISOString()
  item.status = 'acknowledged'
  item.acknowledgedBy = operator
  item.acknowledgedAt = now

  const historyEntry: HistoryEntry = {
    id: newId('hist-'),
    recordId: item.recordId,
    action: 'ack_exception',
    isManual: true,
    operator,
    time: now,
    summary: `确认异常：${item.title}`,
    reason: note,
    oldSnapshot: {},
    newSnapshot: {},
  }
  addHistoryEntry(historyEntry)

  await db.write()
  return item
}

export function tryResolveVaccineMissingForRecord(recordId: string): void {
  const items = db.data.queue.filter(
    (q) => q.recordId === recordId && q.type === 'vaccine_missing',
  )
  for (const item of items) {
    item.status = 'resolved'
  }
}
