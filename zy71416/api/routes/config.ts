import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'crypto'
import db from '../database.js'
import { MCC_DESCRIPTIONS } from '../services/riskService.js'
import type { Employee, Budget } from '../../shared/types.js'

const router = Router()

router.get('/budgets', (_req: Request, res: Response): void => {
  try {
    const rows = db.prepare('SELECT * FROM budgets').all() as any[]
    const data: Budget[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      totalAmount: row.totalAmount,
      usedAmount: row.usedAmount,
      allowedMccs: JSON.parse(row.allowedMccs || '[]'),
    }))
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/budgets', (req: Request, res: Response): void => {
  try {
    const { name, totalAmount, allowedMccs } = req.body
    if (!name || totalAmount === undefined || !allowedMccs) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const id = randomUUID()
    db.prepare(
      'INSERT INTO budgets (id, name, totalAmount, usedAmount, allowedMccs) VALUES (?, ?, ?, 0, ?)'
    ).run(id, name, totalAmount, JSON.stringify(allowedMccs))

    const data: Budget = { id, name, totalAmount, usedAmount: 0, allowedMccs }
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/employees', (_req: Request, res: Response): void => {
  try {
    const rows = db.prepare('SELECT * FROM employees').all() as any[]
    const data: Employee[] = rows.map(row => ({
      id: row.id,
      employeeNo: row.employeeNo,
      name: row.name,
      department: row.department,
    }))
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/employees', (req: Request, res: Response): void => {
  try {
    const { employeeNo, name, department } = req.body
    if (!employeeNo || !name || !department) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const id = randomUUID()
    db.prepare(
      'INSERT INTO employees (id, employeeNo, name, department) VALUES (?, ?, ?, ?)'
    ).run(id, employeeNo, name, department)

    const data: Employee = { id, employeeNo, name, department }
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/mcc-mapping', (_req: Request, res: Response): void => {
  res.json({ success: true, data: MCC_DESCRIPTIONS })
})

router.get('/stats', (_req: Request, res: Response): void => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number }
    const pending = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'").get() as { count: number }
    const normal = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'normal'").get() as { count: number }
    const warning = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'warning'").get() as { count: number }
    const error = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'error'").get() as { count: number }
    const reviewed = db.prepare('SELECT COUNT(*) as count FROM review_results').get() as { count: number }

    res.json({
      success: true,
      data: {
        totalTransactions: total.count,
        pendingCount: pending.count,
        normalCount: normal.count,
        warningCount: warning.count,
        errorCount: error.count,
        reviewedCount: reviewed.count,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
