import { Router, type Request, type Response } from 'express'
import * as svc from '../services/calibrationService.js'

const router = Router()

router.get('/records', (req: Request, res: Response): void => {
  try {
    const status = req.query.status as string | undefined
    const records = svc.getRecords(status)
    res.json({ success: true, data: records })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id', (req: Request, res: Response): void => {
  try {
    const detail = svc.getRecordDetail(req.params.id)
    res.json({ success: true, data: detail })
  } catch (err: any) {
    if (err.message === '记录不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/records/import', (req: Request, res: Response): void => {
  try {
    const result = svc.importCalibrationData(req.body)
    res.status(201).json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.patch('/records/:id/photo', (req: Request, res: Response): void => {
  try {
    const { photoIds, operator } = req.body
    if (!photoIds || !Array.isArray(photoIds) || !operator) {
      res.status(400).json({ success: false, error: 'photoIds 和 operator 为必填' })
      return
    }
    const result = svc.supplementPhoto(req.params.id, photoIds, operator)
    res.json({ success: true, data: result })
  } catch (err: any) {
    if (err.message === '记录不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/records/:id/correct', (req: Request, res: Response): void => {
  try {
    const { entryId, correction, operator, reason } = req.body
    if (!entryId || !correction || !operator || !reason) {
      res.status(400).json({ success: false, error: 'entryId, correction, operator, reason 为必填' })
      return
    }
    const result = svc.manualCorrect(req.params.id, entryId, correction, operator, reason)
    res.json({ success: true, data: result })
  } catch (err: any) {
    if (err.message === '记录不存在' || err.message === '坐标条目不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/records/:id/rerun', (req: Request, res: Response): void => {
  try {
    const { operator } = req.body
    if (!operator) {
      res.status(400).json({ success: false, error: 'operator 为必填' })
      return
    }
    const result = svc.rerunCalibration(req.params.id, operator)
    res.json({ success: true, data: result })
  } catch (err: any) {
    if (err.message === '记录不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id/logs', (req: Request, res: Response): void => {
  try {
    const logs = svc.getOperationLogs(req.params.id)
    res.json({ success: true, data: logs })
  } catch (err: any) {
    if (err.message === '记录不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id/note', (req: Request, res: Response): void => {
  try {
    const note = svc.getFieldTeamNote(req.params.id)
    res.json({ success: true, data: note })
  } catch (err: any) {
    if (err.message === '记录不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id/rerun-command', (req: Request, res: Response): void => {
  try {
    const command = svc.getRerunCommand(req.params.id)
    res.json({ success: true, data: { command } })
  } catch (err: any) {
    if (err.message === '记录不存在') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
