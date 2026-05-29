import db from '../db.js'

export interface Conflict {
  type: 'glaze' | 'size'
  message: string
  details?: Record<string, unknown>
}

export function checkConflicts(workId: string, batchId: string): Conflict[] {
  const conflicts: Conflict[] = []

  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(workId) as any
  if (!work) return conflicts

  const workGlazes = db.prepare('SELECT glaze_id FROM work_glazes WHERE work_id = ?').all(workId) as { glaze_id: string }[]
  const workGlazeIds = workGlazes.map(g => g.glaze_id)

  const batchGlazeRows = db.prepare(`
    SELECT DISTINCT wg.glaze_id
    FROM queue_entries qe
    JOIN work_glazes wg ON wg.work_id = qe.work_id
    WHERE qe.batch_id = ?
  `).all(batchId) as { glaze_id: string }[]
  const batchGlazeIds = batchGlazeRows.map(g => g.glaze_id)

  if (workGlazeIds.length > 0 && batchGlazeIds.length > 0) {
    const allGlazeIds = [...new Set([...workGlazeIds, ...batchGlazeIds])]
    const placeholders = allGlazeIds.map(() => '?').join(',')
    const conflictRows = db.prepare(`
      SELECT * FROM glaze_conflicts
      WHERE (glaze_a_id IN (${placeholders}) AND glaze_b_id IN (${placeholders}))
    `).all(...allGlazeIds, ...allGlazeIds) as any[]

    for (const row of conflictRows) {
      const aInWork = workGlazeIds.includes(row.glaze_a_id)
      const bInWork = workGlazeIds.includes(row.glaze_b_id)
      const aInBatch = batchGlazeIds.includes(row.glaze_a_id)
      const bInBatch = batchGlazeIds.includes(row.glaze_b_id)

      if ((aInWork && bInBatch) || (bInWork && aInBatch)) {
        const glazeA = db.prepare('SELECT name FROM glazes WHERE id = ?').get(row.glaze_a_id) as any
        const glazeB = db.prepare('SELECT name FROM glazes WHERE id = ?').get(row.glaze_b_id) as any
        conflicts.push({
          type: 'glaze',
          message: `${glazeA?.name || row.glaze_a_id} 与 ${glazeB?.name || row.glaze_b_id} 存在冲突：${row.reason}`,
          details: {
            glaze_a_id: row.glaze_a_id,
            glaze_b_id: row.glaze_b_id,
            reason: row.reason,
            conflict_id: row.id,
          },
        })
      }
    }
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (batch && work) {
    if (work.width > batch.max_width || work.height > batch.max_height || work.depth > batch.max_depth) {
      conflicts.push({
        type: 'size',
        message: `作品尺寸 (${work.width}×${work.height}×${work.depth}) 超出窑炉限制 (${batch.max_width}×${batch.max_height}×${batch.max_depth})`,
        details: {
          work_dimensions: { width: work.width, height: work.height, depth: work.depth },
          batch_limits: { max_width: batch.max_width, max_height: batch.max_height, max_depth: batch.max_depth },
        },
      })
    }
  }

  return conflicts
}

export function getBatchConflicts(batchId: string): Conflict[] {
  const conflicts: Conflict[] = []

  const entries = db.prepare('SELECT work_id FROM queue_entries WHERE batch_id = ?').all(batchId) as { work_id: string }[]
  if (entries.length < 2) return conflicts

  const allGlazeIds = new Set<string>()
  const workGlazeMap = new Map<string, string[]>()

  for (const entry of entries) {
    const glazes = db.prepare('SELECT glaze_id FROM work_glazes WHERE work_id = ?').all(entry.work_id) as { glaze_id: string }[]
    const ids = glazes.map(g => g.glaze_id)
    workGlazeMap.set(entry.work_id, ids)
    ids.forEach(id => allGlazeIds.add(id))
  }

  if (allGlazeIds.size > 1) {
    const glazeIdArr = [...allGlazeIds]
    const placeholders = glazeIdArr.map(() => '?').join(',')
    const conflictRows = db.prepare(`
      SELECT * FROM glaze_conflicts
      WHERE (glaze_a_id IN (${placeholders}) AND glaze_b_id IN (${placeholders}))
    `).all(...glazeIdArr, ...glazeIdArr) as any[]

    for (const row of conflictRows) {
      if (allGlazeIds.has(row.glaze_a_id) && allGlazeIds.has(row.glaze_b_id)) {
        const glazeA = db.prepare('SELECT name FROM glazes WHERE id = ?').get(row.glaze_a_id) as any
        const glazeB = db.prepare('SELECT name FROM glazes WHERE id = ?').get(row.glaze_b_id) as any
        conflicts.push({
          type: 'glaze',
          message: `${glazeA?.name || row.glaze_a_id} 与 ${glazeB?.name || row.glaze_b_id} 存在冲突：${row.reason}`,
          details: {
            glaze_a_id: row.glaze_a_id,
            glaze_b_id: row.glaze_b_id,
            reason: row.reason,
            conflict_id: row.id,
          },
        })
      }
    }
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (batch) {
    for (const entry of entries) {
      const work = db.prepare('SELECT * FROM works WHERE id = ?').get(entry.work_id) as any
      if (work && (work.width > batch.max_width || work.height > batch.max_height || work.depth > batch.max_depth)) {
        conflicts.push({
          type: 'size',
          message: `作品「${work.name}」尺寸 (${work.width}×${work.height}×${work.depth}) 超出窑炉限制`,
          details: {
            work_id: work.id,
            work_name: work.name,
            work_dimensions: { width: work.width, height: work.height, depth: work.depth },
            batch_limits: { max_width: batch.max_width, max_height: batch.max_height, max_depth: batch.max_depth },
          },
        })
      }
    }
  }

  return conflicts
}
