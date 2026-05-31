import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { loadSampleData } from '../data-loader.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

function rowToSettlement(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    anchorId: row.anchor_id as string,
    anchorName: row.anchor_name as string,
    totalTip: row.total_tip as number | null,
    refundAmount: row.refund_amount as number | null,
    shareRate: row.share_rate as number | null,
    settlementAmount: row.settlement_amount as number | null,
    status: row.status as string,
    hasChangeHistory: Boolean(row.has_change_history),
    isDuplicate: Boolean(row.is_duplicate),
    hasEmptyFields: Boolean(row.has_empty_fields),
    isFullRefund: Boolean(row.is_full_refund),
    createdAt: row.created_at as string,
  }
}

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const status = req.query.status as string | undefined

  let rows: Record<string, unknown>[]
  if (status && status !== 'all') {
    rows = db.prepare('SELECT * FROM settlement WHERE status = ? ORDER BY created_at DESC').all(status) as Record<string, unknown>[]
  } else {
    rows = db.prepare('SELECT * FROM settlement ORDER BY created_at DESC').all() as Record<string, unknown>[]
  }

  res.json(rows.map(rowToSettlement))
})

router.get('/export', (req: Request, res: Response) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM settlement ORDER BY created_at DESC').all() as Record<string, unknown>[]

  const header = '结算ID,主播ID,主播名称,打赏总额,退款金额,分成比例,结算金额,状态,是否重复,有空值,全额退款,有变更历史,变更历史摘要'

  const statusMap: Record<string, string> = {
    matched: '已匹配',
    needs_review: '需确认',
    overridden: '已改判',
    rolled_back: '已回退',
  }

  const csvRows = rows.map(row => {
    const changes = db.prepare('SELECT * FROM change_history WHERE settlement_id = ? ORDER BY created_at').all(row.id) as Record<string, unknown>[]
    const summary = changes.map(c => `${c.field}:${c.old_value ?? '空'}→${c.new_value}(${c.reason})`).join('; ')

    return [
      row.id,
      row.anchor_id,
      row.anchor_name,
      row.total_tip ?? '',
      row.refund_amount ?? '',
      row.share_rate != null ? row.share_rate : '',
      row.settlement_amount ?? '',
      statusMap[row.status as string] ?? row.status,
      row.is_duplicate ? '是' : '否',
      row.has_empty_fields ? '是' : '否',
      row.is_full_refund ? '是' : '否',
      row.has_change_history ? '是' : '否',
      `"${summary.replace(/"/g, '""')}"`,
    ].join(',')
  })

  const csv = '\uFEFF' + header + '\n' + csvRows.join('\n')

  const reportsDir = path.resolve(__dirname, '../../reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(reportsDir, `settlement-export-${ts}.csv`)
  fs.writeFileSync(reportPath, csv, 'utf-8')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=settlement-export.csv')
  res.send(csv)
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM settlement WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined

  if (!row) {
    res.status(404).json({ error: '结算记录不存在' })
    return
  }

  const settlement = rowToSettlement(row)

  const payment = db.prepare('SELECT * FROM payment_flow WHERE settlement_id = ?').all(req.params.id) as Record<string, unknown>[]
  const refunds = db.prepare('SELECT * FROM refund_request WHERE settlement_id = ?').all(req.params.id) as Record<string, unknown>[]
  const emails = db.prepare('SELECT * FROM approval_email WHERE settlement_id = ?').all(req.params.id) as Record<string, unknown>[]
  const notes = db.prepare('SELECT * FROM handwritten_note WHERE settlement_id = ?').all(req.params.id) as Record<string, unknown>[]
  const changes = db.prepare('SELECT * FROM change_history WHERE settlement_id = ? ORDER BY created_at').all(req.params.id) as Record<string, unknown>[]

  const detail = {
    ...settlement,
    paymentFlow: payment.length > 0 ? {
      transactionId: payment[0].transaction_id as string,
      amount: payment[0].amount as number,
      time: payment[0].time as string,
      platform: payment[0].platform as string,
    } : null,
    refundRequest: refunds.length > 0 ? {
      requestId: refunds[0].request_id as string,
      amount: refunds[0].amount as number,
      reason: refunds[0].reason as string,
      time: refunds[0].time as string,
    } : null,
    approvalEmail: emails.length > 0 ? {
      subject: emails[0].subject as string,
      rawContent: emails[0].raw_content as string,
      parsedAmount: emails[0].parsed_amount as number | null,
      note: emails[0].note as string,
      receivedAt: emails[0].received_at as string,
    } : null,
    handwrittenNote: notes.length > 0 ? (notes[0].content as string) : null,
    changeHistory: changes.map(c => ({
      id: c.id as string,
      field: c.field as string,
      oldValue: c.old_value as string | null,
      newValue: c.new_value as string,
      reason: c.reason as string,
      operator: c.operator as string,
      createdAt: c.created_at as string,
    })),
  }

  res.json(detail)
})

router.post('/:id/override', (req: Request, res: Response) => {
  const db = getDb()
  const { field, newValue, reason } = req.body

  if (!field || newValue === undefined || newValue === '' || !reason) {
    res.status(400).json({ error: '字段名、新值和原因均为必填' })
    return
  }

  const row = db.prepare('SELECT * FROM settlement WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ error: '结算记录不存在' })
    return
  }

  const fieldMap: Record<string, string> = {
    totalTip: 'total_tip',
    refundAmount: 'refund_amount',
    shareRate: 'share_rate',
    settlementAmount: 'settlement_amount',
  }

  const dbField = fieldMap[field]
  if (!dbField) {
    res.status(400).json({ error: `不支持的字段: ${field}` })
    return
  }

  const oldValue = row[dbField] != null ? String(row[dbField]) : null

  const chId = generateId()
  db.prepare(`
    INSERT INTO change_history (id, settlement_id, field, old_value, new_value, reason, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chId, req.params.id, field, oldValue, String(newValue), reason, '阿宁', new Date().toISOString())

  const numValue = parseFloat(String(newValue))
  db.prepare(`UPDATE settlement SET ${dbField} = ?, status = 'overridden', has_change_history = 1 WHERE id = ?`)
    .run(isNaN(numValue) ? String(newValue) : numValue, req.params.id)

  const updated = db.prepare('SELECT * FROM settlement WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json(rowToSettlement(updated))
})

router.post('/:id/rollback', (req: Request, res: Response) => {
  const db = getDb()
  const { reason } = req.body

  if (!reason) {
    res.status(400).json({ error: '回退原因为必填' })
    return
  }

  const row = db.prepare('SELECT * FROM settlement WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ error: '结算记录不存在' })
    return
  }

  const chId = generateId()
  db.prepare(`
    INSERT INTO change_history (id, settlement_id, field, old_value, new_value, reason, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chId, req.params.id, 'status', row.status as string, 'needs_review', reason, '阿宁', new Date().toISOString())

  db.prepare("UPDATE settlement SET status = 'rolled_back', has_change_history = 1 WHERE id = ?")
    .run(req.params.id)

  const updated = db.prepare('SELECT * FROM settlement WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json(rowToSettlement(updated))
})

router.post('/reload', (_req: Request, res: Response) => {
  const count = loadSampleData()
  res.json({ count })
})

export default router
