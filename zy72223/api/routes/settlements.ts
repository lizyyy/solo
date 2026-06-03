import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function generateSummaryForEntry(entry: any) {
  const missingMaterials: string[] = ['原始冲销凭证']
  let reason = ''
  let nextStep = ''
  let responsibleRole: 'fund_accountant' | 'risk_control' = 'risk_control'

  if (entry.amount === 0 && entry.note.includes('已冲正')) {
    reason = '金额为0且备注为已冲正，疑似冲销交易，不能直接归为正常'
    if (entry.tax_rate === null || entry.tax_rate === undefined) {
      missingMaterials.unshift('税费率备注')
      nextStep = '先由基金会计林姐补录税费率备注，再交风控同事复核'
      responsibleRole = 'fund_accountant'
    } else {
      nextStep = '需风控同事复核冲销原因后签署'
      responsibleRole = 'risk_control'
    }
  }

  return { reason, missingMaterials, nextStep, responsibleRole }
}

router.post('/', (req: Request, res: Response): void => {
  const { name, source, entries } = req.body

  if (!name || !source || !Array.isArray(entries)) {
    res.status(400).json({ success: false, error: 'name, source, entries are required' })
    return
  }

  const settlementId = uuidv4()
  const now = new Date().toISOString()

  const insertSettlement = db.prepare(
    `INSERT INTO settlements (id, name, source, imported_at, status) VALUES (?, ?, ?, ?, 'imported')`
  )
  const insertEntry = db.prepare(
    `INSERT INTO entries (id, settlement_id, trade_date, ex_dividend_date, security_code, security_name, amount, note, tax_rate, tax_rate_note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertSummary = db.prepare(
    `INSERT INTO summaries (id, entry_id, reason, missing_materials, next_step, responsible_role, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const insertAuditLog = db.prepare(
    `INSERT INTO audit_logs (id, settlement_id, entry_id, action, operator, detail, command, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const doImport = db.transaction(() => {
    insertSettlement.run(settlementId, name, source, now)

    const createdEntries: any[] = []
    const createdSummaries: any[] = []

    for (const e of entries) {
      const entryId = uuidv4()
      let status: string = 'normal'

      if (e.amount === 0 && e.note && e.note.includes('已冲正')) {
        status = 'pending_review'
      }

      insertEntry.run(
        entryId,
        settlementId,
        e.tradeDate,
        e.exDividendDate ?? null,
        e.securityCode,
        e.securityName,
        e.amount ?? 0,
        e.note ?? '',
        e.taxRate ?? null,
        e.taxRateNote ?? null,
        status
      )

      createdEntries.push({ id: entryId, amount: e.amount ?? 0, note: e.note ?? '', taxRate: e.taxRate ?? null })

      if (status === 'pending_review') {
        const summary = generateSummaryForEntry({
          amount: e.amount ?? 0,
          note: e.note ?? '',
          tax_rate: e.taxRate ?? null,
        })
        const summaryId = uuidv4()
        insertSummary.run(
          summaryId,
          entryId,
          summary.reason,
          JSON.stringify(summary.missingMaterials),
          summary.nextStep,
          summary.responsibleRole,
          now
        )
        createdSummaries.push({ id: summaryId, entryId })
      }
    }

    const command = `settle import --file ${name}.json --source ${source}`
    insertAuditLog.run(
      uuidv4(),
      settlementId,
      null,
      'import',
      '基金会计林姐',
      `导入${name}，共${entries.length}条记录`,
      command,
      now
    )

    return { settlementId, createdEntries, createdSummaries }
  })

  const result = doImport()

  res.status(201).json({ success: true, data: { id: result.settlementId } })
})

router.get('/', (_req: Request, res: Response): void => {
  const rows = db.prepare(`SELECT * FROM settlements ORDER BY imported_at DESC`).all()
  const data = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    importedAt: row.imported_at,
    status: row.status,
  }))
  res.json({ success: true, data })
})

router.get('/:id', (req: Request, res: Response): void => {
  const settlement = db.prepare(`SELECT * FROM settlements WHERE id = ?`).get(req.params.id) as any
  if (!settlement) {
    res.status(404).json({ success: false, error: 'Settlement not found' })
    return
  }

  const entries = db.prepare(`SELECT * FROM entries WHERE settlement_id = ?`).all(req.params.id) as any[]
  const mappedEntries = entries.map((row: any) => ({
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
  }))

  res.json({
    success: true,
    data: {
      id: settlement.id,
      name: settlement.name,
      source: settlement.source,
      importedAt: settlement.imported_at,
      status: settlement.status,
      entries: mappedEntries,
    },
  })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const settlement = db.prepare(`SELECT * FROM settlements WHERE id = ?`).get(req.params.id) as any
  if (!settlement) {
    res.status(404).json({ success: false, error: 'Settlement not found' })
    return
  }

  const doDelete = db.transaction(() => {
    const entryIds = db.prepare(`SELECT id FROM entries WHERE settlement_id = ?`).all(req.params.id) as any[]
    for (const e of entryIds) {
      db.prepare(`DELETE FROM summaries WHERE entry_id = ?`).run(e.id)
    }
    db.prepare(`DELETE FROM entries WHERE settlement_id = ?`).run(req.params.id)
    db.prepare(`DELETE FROM audit_logs WHERE settlement_id = ?`).run(req.params.id)
    db.prepare(`DELETE FROM settlements WHERE id = ?`).run(req.params.id)
  })

  doDelete()
  res.json({ success: true })
})

router.post('/:id/rerun', (req: Request, res: Response): void => {
  const settlement = db.prepare(`SELECT * FROM settlements WHERE id = ?`).get(req.params.id) as any
  if (!settlement) {
    res.status(404).json({ success: false, error: 'Settlement not found' })
    return
  }

  const now = new Date().toISOString()
  const command = `settle import --file ${settlement.name}.json --source ${settlement.source} --rerun`

  db.prepare(
    `INSERT INTO audit_logs (id, settlement_id, entry_id, action, operator, detail, command, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    req.params.id,
    null,
    'rerun',
    '基金会计林姐',
    `重跑导入${settlement.name}`,
    command,
    now
  )

  res.json({ success: true, data: { command } })
})

export default router
