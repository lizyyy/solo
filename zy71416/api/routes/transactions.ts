import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'crypto'
import db from '../database.js'
import { runRiskCheck } from '../services/riskService.js'
import type { Transaction, TransactionWithDetails } from '../../shared/types.js'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  try {
    const { cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo } = req.body

    if (!cardNo || !amount || !merchantName || !mcc || !transactionTime || !employeeId || !budgetId) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const id = randomUUID()
    db.prepare(
      `INSERT INTO transactions (id, cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(id, cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo || null)

    const result = runRiskCheck(id)

    res.status(201).json({ success: true, data: { transactionId: id, ...result } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/batch', (req: Request, res: Response): void => {
  try {
    const { transactions } = req.body
    if (!Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ success: false, error: '请提供交易数组' })
      return
    }

    const results: any[] = []

    for (const txn of transactions) {
      const { cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo } = txn
      if (!cardNo || !amount || !merchantName || !mcc || !transactionTime || !employeeId || !budgetId) {
        results.push({ success: false, error: '缺少必填字段', data: txn })
        continue
      }

      const id = randomUUID()
      db.prepare(
        `INSERT INTO transactions (id, cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).run(id, cardNo, amount, merchantName, mcc, transactionTime, employeeId, budgetId, reimbursementNo || null)

      const checkResult = runRiskCheck(id)
      results.push({ success: true, data: { transactionId: id, ...checkResult } })
    }

    res.status(201).json({ success: true, data: results })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const { status, keyword } = req.query

    let sql = `
      SELECT t.*, e.employeeNo, e.name as employeeName, e.department,
             b.name as budgetName, b.totalAmount as budgetTotal, b.usedAmount as budgetUsed, b.allowedMccs
      FROM transactions t
      LEFT JOIN employees e ON t.employeeId = e.id
      LEFT JOIN budgets b ON t.budgetId = b.id
      WHERE 1=1
    `
    const params: any[] = []

    if (status) {
      sql += ' AND t.status = ?'
      params.push(status)
    }

    if (keyword) {
      sql += ' AND (t.merchantName LIKE ? OR e.name LIKE ? OR t.cardNo LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }

    sql += ' ORDER BY t.createdAt DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const data: TransactionWithDetails[] = rows.map(row => ({
      id: row.id,
      cardNo: row.cardNo,
      amount: row.amount,
      merchantName: row.merchantName,
      mcc: row.mcc,
      transactionTime: row.transactionTime,
      employeeId: row.employeeId,
      budgetId: row.budgetId,
      reimbursementNo: row.reimbursementNo || '',
      status: row.status,
      createdAt: row.createdAt,
      employee: row.employeeNo ? {
        id: row.employeeId,
        employeeNo: row.employeeNo,
        name: row.employeeName,
        department: row.department,
      } : undefined,
      budget: row.budgetName ? {
        id: row.budgetId,
        name: row.budgetName,
        totalAmount: row.budgetTotal,
        usedAmount: row.budgetUsed,
        allowedMccs: JSON.parse(row.allowedMccs || '[]'),
      } : undefined,
    }))

    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const txn = db.prepare(`
      SELECT t.*, e.employeeNo, e.name as employeeName, e.department,
             b.name as budgetName, b.totalAmount as budgetTotal, b.usedAmount as budgetUsed, b.allowedMccs
      FROM transactions t
      LEFT JOIN employees e ON t.employeeId = e.id
      LEFT JOIN budgets b ON t.budgetId = b.id
      WHERE t.id = ?
    `).get(req.params.id) as any

    if (!txn) {
      res.status(404).json({ success: false, error: '交易不存在' })
      return
    }

    const flags = db.prepare('SELECT * FROM risk_flags WHERE transactionId = ?').all(txn.id) as any[]

    const review = db.prepare('SELECT * FROM review_results WHERE transactionId = ?').get(txn.id) as any

    const data: TransactionWithDetails = {
      id: txn.id,
      cardNo: txn.cardNo,
      amount: txn.amount,
      merchantName: txn.merchantName,
      mcc: txn.mcc,
      transactionTime: txn.transactionTime,
      employeeId: txn.employeeId,
      budgetId: txn.budgetId,
      reimbursementNo: txn.reimbursementNo || '',
      status: txn.status,
      createdAt: txn.createdAt,
      employee: txn.employeeNo ? {
        id: txn.employeeId,
        employeeNo: txn.employeeNo,
        name: txn.employeeName,
        department: txn.department,
      } : undefined,
      budget: txn.budgetName ? {
        id: txn.budgetId,
        name: txn.budgetName,
        totalAmount: txn.budgetTotal,
        usedAmount: txn.budgetUsed,
        allowedMccs: JSON.parse(txn.allowedMccs || '[]'),
      } : undefined,
      riskFlags: flags.map(f => ({
        id: f.id,
        transactionId: f.transactionId,
        type: f.type,
        severity: f.severity,
        detail: f.detail,
        humanReason: f.humanReason,
        createdAt: f.createdAt,
      })),
      reviewResult: review ? {
        id: review.id,
        transactionId: review.transactionId,
        reviewer: review.reviewer,
        decision: review.decision,
        comment: review.comment || '',
        createdAt: review.createdAt,
      } : undefined,
    }

    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
