import { Router, type Request, type Response } from 'express'
import { getMergedPointsByBatch, getMergedPointById, createAppendedNote } from '../repositories/merged-point.repo.js'
import { mergeData } from '../services/merge.service.js'
import { createAuditLog } from '../repositories/audit-log.repo.js'

const router = Router()

router.post('/:batchId/merge', (req: Request, res: Response): void => {
  try {
    const actor = req.body.actor || 'system'
    const result = mergeData(req.params.batchId, actor)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:batchId/merged-points', (req: Request, res: Response): void => {
  try {
    const points = getMergedPointsByBatch(req.params.batchId)
    res.json({ success: true, data: points })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/points/:id', (req: Request, res: Response): void => {
  try {
    const point = getMergedPointById(req.params.id)
    if (!point) {
      res.status(404).json({ success: false, error: '合并点位不存在' })
      return
    }
    res.json({ success: true, data: point })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/points/:pointId/notes', (req: Request, res: Response): void => {
  try {
    const { content, author } = req.body
    if (!content || !content.trim()) {
      res.status(400).json({ success: false, error: '备注内容不能为空' })
      return
    }
    const point = getMergedPointById(req.params.pointId)
    if (!point) {
      res.status(404).json({ success: false, error: '合并点位不存在' })
      return
    }
    const note = createAppendedNote({
      mergedPointId: req.params.pointId,
      content: content.trim(),
      author: author || 'system',
    })

    createAuditLog({
      batchId: point.batchId,
      action: 'note_append',
      actor: author || 'system',
      detail: `追加备注：${content.trim()}`,
      relatedId: req.params.pointId,
    })

    res.status(201).json({ success: true, data: note })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
