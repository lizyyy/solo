import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'
import type { Batch, BatchSummary } from '../../shared/types.js'

export function listBatches(): Batch[] {
  const rows = db.prepare('SELECT * FROM batch ORDER BY created_at DESC').all() as any[]
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export function getBatchById(id: string): Batch | undefined {
  const row = db.prepare('SELECT * FROM batch WHERE id = ?').get(id) as any
  if (!row) return undefined
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createBatch(name: string): Batch {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO batch (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, 'active', now, now)
  return { id, name, status: 'active', createdAt: now, updatedAt: now }
}

export function updateBatchStatus(id: string, status: string): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE batch SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
}

export function getBatchSummary(batchId: string): BatchSummary | undefined {
  const batch = getBatchById(batchId)
  if (!batch) return undefined

  const importCount = (db.prepare('SELECT COUNT(*) as cnt FROM import_job WHERE batch_id = ?').get(batchId) as any).cnt
  const mergedPointCount = (db.prepare('SELECT COUNT(*) as cnt FROM merged_point WHERE batch_id = ?').get(batchId) as any).cnt
  const conflictCount = (db.prepare('SELECT COUNT(*) as cnt FROM conflict_item ci JOIN merged_point mp ON ci.merged_point_id = mp.id WHERE mp.batch_id = ?').get(batchId) as any).cnt
  const unresolvedConflictCount = (db.prepare("SELECT COUNT(*) as cnt FROM conflict_item ci JOIN merged_point mp ON ci.merged_point_id = mp.id WHERE mp.batch_id = ? AND ci.resolution IS NULL").get(batchId) as any).cnt
  const anomalyCount = (db.prepare('SELECT COUNT(*) as cnt FROM anomaly WHERE batch_id = ?').get(batchId) as any).cnt

  return {
    batch,
    importCount,
    mergedPointCount,
    conflictCount,
    unresolvedConflictCount,
    anomalyCount,
  }
}
