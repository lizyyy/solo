import { Router, type Request, type Response } from 'express'
import db from '../database.js'
import { MCC_DESCRIPTIONS } from '../services/riskService.js'

const router = Router()

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

router.get('/csv', (_req: Request, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT t.id, t.cardNo, t.amount, t.merchantName, t.mcc, t.transactionTime,
             e.employeeNo, e.name as employeeName, e.department,
             b.name as budgetName, b.totalAmount as budgetTotal, b.usedAmount as budgetUsed
      FROM transactions t
      LEFT JOIN employees e ON t.employeeId = e.id
      LEFT JOIN budgets b ON t.budgetId = b.id
      ORDER BY t.createdAt DESC
    `).all() as any[]

    const flagsByTxn = db.prepare('SELECT * FROM risk_flags ORDER BY transactionId').all() as any[]
    const flagsMap = new Map<string, any[]>()
    for (const f of flagsByTxn) {
      if (!flagsMap.has(f.transactionId)) flagsMap.set(f.transactionId, [])
      flagsMap.get(f.transactionId)!.push(f)
    }

    const reviewsByTxn = db.prepare('SELECT * FROM review_results').all() as any[]
    const reviewsMap = new Map<string, any>()
    for (const r of reviewsByTxn) {
      reviewsMap.set(r.transactionId, r)
    }

    const headers = [
      '交易编号', '卡号', '金额', '商户名称', 'MCC', '交易时间',
      '员工工号', '员工姓名', '部门', '预算科目', '预算总额', '预算已用',
      '风控类型', '风控等级', '风控理由',
      '复核结论', '复核意见', '复核时间',
    ]

    const lines: string[] = [headers.map(escapeCsv).join(',')]

    for (const row of rows) {
      const flags = flagsMap.get(row.id) || []
      const review = reviewsMap.get(row.id)

      const commonFields = [
        row.id, row.cardNo, String(row.amount), row.merchantName, row.mcc, row.transactionTime,
        row.employeeNo || '', row.employeeName || '', row.department || '',
        row.budgetName || '', String(row.budgetTotal || ''), String(row.budgetUsed || ''),
      ]

      if (flags.length === 0) {
        const line = [
          ...commonFields,
          '', '', '',
          review ? review.decision : '', review ? (review.comment || '') : '', review ? review.createdAt : '',
        ].map(v => escapeCsv(String(v))).join(',')
        lines.push(line)
      } else {
        for (let i = 0; i < flags.length; i++) {
          const flag = flags[i]
          const line = [
            ...(i === 0 ? commonFields : Array(12).fill('')),
            flag.type, flag.severity, flag.humanReason,
            i === 0 ? (review ? review.decision : '') : '',
            i === 0 ? (review ? (review.comment || '') : '') : '',
            i === 0 ? (review ? review.createdAt : '') : '',
          ].map(v => escapeCsv(String(v))).join(',')
          lines.push(line)
        }
      }
    }

    const csv = '\uFEFF' + lines.join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=vcard_transactions.csv')
    res.send(csv)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
