import { Router, type Request, type Response } from 'express'
import { getConflictsByBatch, getConflictById, resolveConflict, countUnresolvedConflicts } from '../repositories/conflict-item.repo.js'
import { updateMergedPointConflictStatus } from '../repositories/merged-point.repo.js'
import { createAuditLog } from '../repositories/audit-log.repo.js'
import db from '../database.js'

const router = Router()

router.get('/:batchId/conflicts', (req: Request, res: Response): void => {
  try {
    const conflicts = getConflictsByBatch(req.params.batchId)
    res.json({ success: true, data: conflicts })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/detail/:id', (req: Request, res: Response): void => {
  try {
    const conflict = getConflictById(req.params.id)
    if (!conflict) {
      res.status(404).json({ success: false, error: '冲突记录不存在' })
      return
    }
    res.json({ success: true, data: conflict })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/resolve', (req: Request, res: Response): void => {
  try {
    const { resolution, resolutionReason, resolvedBy } = req.body
    if (!resolution) {
      res.status(400).json({ success: false, error: '解决方案不能为空' })
      return
    }
    const conflict = getConflictById(req.params.id)
    if (!conflict) {
      res.status(404).json({ success: false, error: '冲突记录不存在' })
      return
    }

    resolveConflict(req.params.id, resolution, resolutionReason || '', resolvedBy || 'system')

    const unresolved = countUnresolvedConflicts(conflict.mergedPointId)
    if (unresolved === 0) {
      updateMergedPointConflictStatus(conflict.mergedPointId, 'resolved')
    }

    const row = db.prepare('SELECT mp.batch_id FROM merged_point mp WHERE mp.id = ?').get(conflict.mergedPointId) as any
    if (row) {
      createAuditLog({
        batchId: row.batch_id,
        action: 'resolve',
        actor: resolvedBy || 'system',
        detail: `解决冲突：字段 ${conflict.fieldName}，方案：${resolution}`,
        relatedId: req.params.id,
      })
    }

    res.json({ success: true, data: { id: req.params.id, resolution, resolved: true } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
