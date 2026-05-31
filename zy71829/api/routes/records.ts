import { Router, type Request, type Response } from 'express'
import * as service from '../service.js'
import type { CreateRecordRequest, UpdateStatusRequest } from '../../shared/types.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const filters = {
    source: req.query.source as string | undefined,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
  }
  const records = service.getAllRecords(filters)
  res.json({ success: true, data: records })
})

router.get('/audit', (req: Request, res: Response): void => {
  const filters = {
    operator: req.query.operator as string | undefined,
    recordId: req.query.recordId as string | undefined,
  }
  const logs = service.getAuditLogs(filters)
  res.json({ success: true, data: logs })
})

router.get('/:id', (req: Request, res: Response): void => {
  const detail = service.getRecordDetail(req.params.id)
  if (!detail) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, data: detail })
})

router.post('/', (req: Request, res: Response): void => {
  const body = req.body as CreateRecordRequest
  if (!body.activityId || !body.source || !body.submittedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段: activityId, source, submittedBy' })
    return
  }

  const validSources = ['活动复盘', '关卡草表']
  if (!validSources.includes(body.source)) {
    res.status(400).json({ success: false, error: 'source 必须是 活动复盘 或 关卡草表' })
    return
  }

  const result = service.createRecordWithCheck(body)
  res.status(201).json({
    success: true,
    data: result.record,
    isDuplicate: result.isDuplicate,
    relatedExistingId: result.relatedExistingId,
  })
})

router.patch('/:id/status', (req: Request, res: Response): void => {
  const body = req.body as UpdateStatusRequest
  if (!body.toStatus || !body.changedBy || !body.reason) {
    res.status(400).json({ success: false, error: '缺少必填字段: toStatus, changedBy, reason' })
    return
  }

  const validStatuses = ['待草表', '待确认', '已完成', '已驳回']
  if (!validStatuses.includes(body.toStatus)) {
    res.status(400).json({ success: false, error: 'toStatus 无效' })
    return
  }

  try {
    const detail = service.updateStatus(req.params.id, body)
    res.json({ success: true, data: detail })
  } catch (err) {
    const message = err instanceof Error ? err.message : '状态更新失败'
    res.status(400).json({ success: false, error: message })
  }
})

export default router
