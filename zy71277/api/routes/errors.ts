import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { ErrorCause } from '../../shared/types.js'

const router = Router()

function rowToErrorCause(row: Record<string, unknown>): ErrorCause {
  return {
    id: row.id as string,
    analysisId: row.analysis_id as string,
    type: row.type as ErrorCause['type'],
    timeMsStart: row.time_ms_start as number,
    timeMsEnd: row.time_ms_end as number,
    reason: row.reason as string,
    impactScore: row.impact_score as number,
    impactRange: row.impact_range as string,
    affectedBeatIds: JSON.parse(row.affected_beat_ids as string),
    nextAction: row.next_action as ErrorCause['nextAction'],
    nextActionReason: row.next_action_reason as string,
    resolvedAt: (row.resolved_at as string) ?? undefined,
    resolvedBy: (row.resolved_by as string) ?? undefined,
    resolution: (row.resolution as string) ?? undefined,
  }
}

router.get(
  '/:analysisId/errors',
  (req: Request, res: Response): void => {
    const { analysisId } = req.params
    const rows = db
      .prepare(`SELECT * FROM error_causes WHERE analysis_id = ? ORDER BY time_ms_start`)
      .all(analysisId) as Record<string, unknown>[]

    const errors = rows.map(rowToErrorCause)
    res.json({ success: true, data: errors })
  }
)

router.put(
  '/:id/resolve',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const { action, resolution } = req.body

    if (!resolution) {
      res
        .status(400)
        .json({ success: false, error: 'resolution is required' })
      return
    }

    const existing = db
      .prepare(`SELECT * FROM error_causes WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined
    if (!existing) {
      res.status(404).json({ success: false, error: 'Error cause not found' })
      return
    }

    const now = new Date().toISOString()
    db.prepare(
      `UPDATE error_causes SET resolved_at = ?, resolved_by = ?, resolution = ?, next_action = ? WHERE id = ?`
    ).run(now, action || 'manual', resolution, action || existing.next_action, id)

    const row = db
      .prepare(`SELECT * FROM error_causes WHERE id = ?`)
      .get(id) as Record<string, unknown>

    res.json({ success: true, data: rowToErrorCause(row) })
  }
)

export default router
