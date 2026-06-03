import { Router, type Request, type Response } from 'express'
import * as ledger from '../services/ledger.js'
import { seedDemoData } from '../services/seed.js'

const router = Router()

router.get('/stats', (req: Request, res: Response): void => {
  try {
    const data = ledger.getStats()
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/audit-logs', (req: Request, res: Response): void => {
  try {
    const { recordId } = req.query
    const data = ledger.getAuditLogs(recordId as string | undefined)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/screenshot/:id', (req: Request, res: Response): void => {
  try {
    const data = ledger.getScreenshot(req.params.id)
    if (!data) {
      res.status(404).json({ success: false, error: 'Screenshot not found' })
      return
    }
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/screenshot-by-record/:recordId', (req: Request, res: Response): void => {
  try {
    const data = ledger.getScreenshotByRecordId(req.params.recordId)
    if (!data) {
      res.status(404).json({ success: false, error: 'Screenshot not found' })
      return
    }
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/import', (req: Request, res: Response): void => {
  try {
    const { records, operator } = req.body
    ledger.importRecords(records, operator)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/rerun', (req: Request, res: Response): void => {
  try {
    const { recordId, operator } = req.body
    ledger.rerun(recordId, operator)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/demo/seed', (req: Request, res: Response): void => {
  try {
    seedDemoData()
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const { status } = req.query
    const data = ledger.getAll(status as string | undefined)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const data = ledger.getById(req.params.id)
    if (!data) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/supplement', (req: Request, res: Response): void => {
  try {
    const { rate, remark, operator } = req.body
    ledger.supplement(req.params.id, rate, remark, operator)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/correct', (req: Request, res: Response): void => {
  try {
    const { field, value, operator } = req.body
    ledger.correct(req.params.id, field, value, operator)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/confirm', (req: Request, res: Response): void => {
  try {
    const { operator } = req.body
    ledger.confirm(req.params.id, operator)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/reject', (req: Request, res: Response): void => {
  try {
    const { operator } = req.body
    ledger.reject(req.params.id, operator)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
