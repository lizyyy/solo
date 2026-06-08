import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'
import type { Anomaly } from '../../shared/types.js'

function rowToAnomaly(row: any): Anomaly {
  return {
    id: row.id,
    mergedPointId: row.merged_point_id,
    batchId: row.batch_id,
    type: row.type,
    description: row.description,
    humanReadable: row.human_readable,
    detectedAt: row.detected_at,
  }
}

export function createAnomaly(data: {
  mergedPointId: string
  batchId: string
  type: string
  description: string
  humanReadable: string
}): Anomaly {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(
    `INSERT INTO anomaly (id, merged_point_id, batch_id, type, description, human_readable, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.mergedPointId, data.batchId, data.type, data.description, data.humanReadable, now)
  return {
    id, mergedPointId: data.mergedPointId, batchId: data.batchId,
    type: data.type as any, description: data.description,
    humanReadable: data.humanReadable, detectedAt: now,
  }
}

export function anomalyExists(mergedPointId: string, type: string): boolean {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM anomaly WHERE merged_point_id = ? AND type = ?').get(mergedPointId, type) as any
  return row.cnt > 0
}

export function getAnomaliesByBatch(batchId: string): Anomaly[] {
  const rows = db.prepare('SELECT * FROM anomaly WHERE batch_id = ? ORDER BY detected_at DESC').all(batchId) as any[]
  return rows.map(rowToAnomaly)
}

export function countAnomaliesByBatch(batchId: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM anomaly WHERE batch_id = ?').get(batchId) as any
  return row.cnt
}
