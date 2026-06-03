import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function mapEntry(row: any) {
  return {
    id: row.id,
    settlementId: row.settlement_id,
    tradeDate: row.trade_date,
    exDividendDate: row.ex_dividend_date,
    securityCode: row.security_code,
    securityName: row.security_name,
    amount: row.amount,
    note: row.note,
    taxRate: row.tax_rate,
    taxRateNote: row.tax_rate_note,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    correctionReason: row.correction_reason,
  }
}

router.get('/', (req: Request, res: Response): void => {
  const { status } = req.query
  let rows: any[]

  if (status) {
    rows = db.prepare(`SELECT * FROM entries WHERE status = ?`).all(status)
  } else {
    rows = db.prepare(`SELECT * FROM entries`).all()
  }

  res.json({ success: true, data: rows.map(mapEntry) })
})

router.patch('/:id', (req: Request, res: Response): void => {
  const { amount, note, correctionReason } = req.body
  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(req.params.id) as any

  if (!entry) {
    res.status(404).json({ success: false, error: 'Entry not found' })
    return
  }

  if (!correctionReason) {
    res.status(400).json({ success: false, error: 'correctionReason is required' })
    return
  }

  const now = new Date().toISOString()
  const newAmount = amount !== undefined ? amount : entry.amount
  const newNote = note !== undefined ? note : entry.note

  const doUpdate = db.transaction(() => {
    db.prepare(
      `UPDATE entries SET amount = ?, note = ?, status = 'corrected', correction_reason = ? WHERE id = ?`
    ).run(newAmount, newNote, correctionReason, req.params.id)

    const oldAmount = entry.amount
    const detail = `修正${entry.security_name}(${entry.security_code})金额：${oldAmount}→${newAmount}，原因：${correctionReason}`

    db.prepare(
      `INSERT INTO audit_logs (id, settlement_id, entry_id, action, operator, detail, command, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      entry.settlement_id,
      req.params.id,
      'manual_correction',
      '基金会计林姐',
      detail,
      null,
      now
    )
  })

  doUpdate()

  const updated = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(req.params.id) as any
  res.json({ success: true, data: mapEntry(updated) })
})

router.post('/:id/notes', (req: Request, res: Response): void => {
  const { taxRate, taxRateNote, operator } = req.body
  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(req.params.id) as any

  if (!entry) {
    res.status(404).json({ success: false, error: 'Entry not found' })
    return
  }

  if (taxRate === undefined || !taxRateNote || !operator) {
    res.status(400).json({ success: false, error: 'taxRate, taxRateNote, operator are required' })
    return
  }

  const now = new Date().toISOString()

  const doUpdate = db.transaction(() => {
    db.prepare(
      `UPDATE entries SET tax_rate = ?, tax_rate_note = ? WHERE id = ?`
    ).run(taxRate, taxRateNote, req.params.id)

    db.prepare(
      `UPDATE settlements SET status = 'notes_supplemented' WHERE id = ?`
    ).run(entry.settlement_id)

    db.prepare(
      `DELETE FROM summaries WHERE entry_id = ?`
    ).run(req.params.id)

    const missingMaterials: string[] = ['原始冲销凭证']
    let reason = ''
    let nextStep = ''
    let responsibleRole: 'fund_accountant' | 'risk_control' = 'risk_control'

    if (entry.amount === 0 && entry.note.includes('已冲正')) {
      reason = '金额为0且备注为已冲正，疑似冲销交易，不能直接归为正常'
      nextStep = '需风控同事复核冲销原因后签署'
      responsibleRole = 'risk_control'
    }

    db.prepare(
      `INSERT INTO summaries (id, entry_id, reason, missing_materials, next_step, responsible_role, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      req.params.id,
      reason,
      JSON.stringify(missingMaterials),
      nextStep,
      responsibleRole,
      now
    )

    const detail = `为${entry.security_name}(${entry.security_code})补录税费率：${taxRateNote}`
    db.prepare(
      `INSERT INTO audit_logs (id, settlement_id, entry_id, action, operator, detail, command, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      entry.settlement_id,
      req.params.id,
      'supplement_note',
      operator,
      detail,
      null,
      now
    )
  })

  doUpdate()

  const updated = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(req.params.id) as any
  res.json({ success: true, data: mapEntry(updated) })
})

router.patch('/:id/review', (req: Request, res: Response): void => {
  const { reviewedBy } = req.body
  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(req.params.id) as any

  if (!entry) {
    res.status(404).json({ success: false, error: 'Entry not found' })
    return
  }

  if (!reviewedBy) {
    res.status(400).json({ success: false, error: 'reviewedBy is required' })
    return
  }

  const now = new Date().toISOString()

  const doUpdate = db.transaction(() => {
    db.prepare(
      `UPDATE entries SET status = 'reviewed', reviewed_by = ?, reviewed_at = ? WHERE id = ?`
    ).run(reviewedBy, now, req.params.id)

    const detail = `风控复核通过：${entry.security_name}(${entry.security_code})，复核人：${reviewedBy}`
    db.prepare(
      `INSERT INTO audit_logs (id, settlement_id, entry_id, action, operator, detail, command, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      entry.settlement_id,
      req.params.id,
      'review',
      reviewedBy,
      detail,
      null,
      now
    )
  })

  doUpdate()

  const updated = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(req.params.id) as any
  res.json({ success: true, data: mapEntry(updated) })
})

export default router
