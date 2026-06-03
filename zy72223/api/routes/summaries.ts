import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function mapSummary(row: any) {
  return {
    id: row.id,
    entryId: row.entry_id,
    reason: row.reason,
    missingMaterials: JSON.parse(row.missing_materials),
    nextStep: row.next_step,
    responsibleRole: row.responsible_role,
    generatedAt: row.generated_at,
  }
}

router.get('/', (req: Request, res: Response): void => {
  const { settlementId } = req.query
  let rows: any[]

  if (settlementId) {
    rows = db.prepare(`
      SELECT s.* FROM summaries s
      JOIN entries e ON s.entry_id = e.id
      WHERE e.settlement_id = ?
    `).all(settlementId)
  } else {
    rows = db.prepare(`SELECT * FROM summaries`).all()
  }

  res.json({ success: true, data: rows.map(mapSummary) })
})

router.post('/refresh', (_req: Request, res: Response): void => {
  const now = new Date().toISOString()

  const pendingEntries = db.prepare(`
    SELECT e.*, s.id as settlement_id FROM entries e
    JOIN settlements s ON e.settlement_id = s.id
    WHERE e.status = 'pending_review' AND e.tax_rate IS NOT NULL
  `).all() as any[]

  const doRefresh = db.transaction(() => {
    const affectedSettlementIds = new Set<string>()

    for (const entry of pendingEntries) {
      db.prepare(`DELETE FROM summaries WHERE entry_id = ?`).run(entry.id)

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
        entry.id,
        reason,
        JSON.stringify(missingMaterials),
        nextStep,
        responsibleRole,
        now
      )

      affectedSettlementIds.add(entry.settlement_id)
    }

    for (const sid of affectedSettlementIds) {
      db.prepare(`UPDATE settlements SET status = 'summary_updated' WHERE id = ?`).run(sid)
    }

    return affectedSettlementIds.size
  })

  const count = doRefresh()
  res.json({ success: true, data: { refreshedSettlements: count } })
})

export default router
