import { Router, type Request, type Response } from 'express'
import * as taskService from '../services/taskService.js'
import * as boxOfficeService from '../services/boxOfficeService.js'
import * as sessionService from '../services/sessionService.js'
import * as settlementService from '../services/settlementService.js'
import * as exportService from '../services/exportService.js'
import { AppDataSource } from '../database.js'
import { ShowSession } from '../entities/ShowSession.js'
import { FilmContract } from '../entities/FilmContract.js'
import { SettlementResult } from '../entities/SettlementResult.js'
import * as XLSX from 'xlsx'

const router = Router()

router.get('/tasks', async (_req: Request, res: Response) => {
  try {
    const tasks = await taskService.listTasks()
    res.json({ success: true, data: tasks })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const task = await taskService.createTask(req.body)
    res.json({ success: true, data: task })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await taskService.getTaskById(req.params.id)
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body)
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const task = await taskService.withdrawTask(req.params.id)
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.get('/tasks/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await taskService.getTaskHistory(req.params.id)
    res.json({ success: true, data: history })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/import/tickets', async (req: Request, res: Response) => {
  try {
    const data = parseImportData(req)
    const result = await boxOfficeService.importTickets(req.params.id, data)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/import/refunds', async (req: Request, res: Response) => {
  try {
    const data = parseImportData(req)
    const result = await boxOfficeService.importRefunds(req.params.id, data)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/import/coupons', async (req: Request, res: Response) => {
  try {
    const data = parseImportData(req)
    const result = await boxOfficeService.importCoupons(req.params.id, data)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/import/shows', async (req: Request, res: Response) => {
  try {
    const data = parseImportData(req)
    const result = await sessionService.importShowSessions(req.params.id, data)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/import/contracts', async (req: Request, res: Response) => {
  try {
    const data = parseImportData(req)
    const result = await settlementService.importContracts(req.params.id, data)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/map-sessions', async (req: Request, res: Response) => {
  try {
    const result = await sessionService.mapSessions(req.params.id)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/calculate', async (req: Request, res: Response) => {
  try {
    const result = await settlementService.calculateSettlement(req.params.id)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/tasks/:id/boxoffice', async (req: Request, res: Response) => {
  try {
    const records = await boxOfficeService.getBoxOfficeRecords(req.params.id)
    res.json({ success: true, data: records })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/tasks/:id/sessions', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(ShowSession)
    const sessions = await repo.find({ where: { task: { id: req.params.id } }, order: { showTime: 'ASC' } })
    res.json({ success: true, data: sessions })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/tasks/:id/contracts', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(FilmContract)
    const contracts = await repo.find({ where: { task: { id: req.params.id } } })
    res.json({ success: true, data: contracts })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/tasks/:id/settlements', async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(SettlementResult)
    const results = await repo.find({ where: { task: { id: req.params.id } } })
    res.json({ success: true, data: results })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.put('/boxoffice/:id/note', async (req: Request, res: Response) => {
  try {
    const record = await boxOfficeService.updateDiffNote(req.params.id, req.body.diffNote ?? '')
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }
    res.json({ success: true, data: record })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/export', async (req: Request, res: Response) => {
  try {
    const buffer = await exportService.exportExcel(req.params.id)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=settlement.xlsx')
    res.send(buffer)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/tasks/:id/resume', async (req: Request, res: Response) => {
  try {
    const task = await taskService.resumeTask(req.params.id)
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }
    res.json({ success: true, data: task })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

export default router

function parseImportData(req: Request): any[] {
  if (Array.isArray(req.body)) {
    return req.body
  }
  if (req.body?.data && Array.isArray(req.body.data)) {
    return req.body.data
  }
  return [req.body]
}
