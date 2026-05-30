import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

router.get('/:id/export', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    res.status(404).json({ success: false, error: 'Batch not found' })
    return
  }

  const rows = db.prepare(`
    SELECT
      pr.bond_code,
      COALESCE(c.bond_name, '') as bond_name,
      c.face_value,
      c.quantity,
      pr.discount_rate,
      pr.discount_amount,
      pr.conclusion,
      pr.warnings,
      COALESCE(rv.status, '待复核') as review_status,
      t.direction,
      t.counterparty,
      t.amount,
      t.term
    FROM process_results pr
    LEFT JOIN collaterals c ON pr.collateral_id = c.id
    LEFT JOIN trades t ON pr.trade_id = t.id
    LEFT JOIN review_records rv ON pr.id = rv.result_id
    WHERE pr.batch_id = ?
  `).all(batchId) as any[]

  const headers = ['债券代码', '债券名称', '面值', '数量', '折算率', '折算金额', '结论', '异常原因', '复核状态', '交易方向', '对手方', '金额', '期限']
  const lines: string[] = [headers.join(',')]

  for (const row of rows) {
    let warningMsg = ''
    try {
      const warnings = JSON.parse(row.warnings || '[]')
      warningMsg = warnings.map((w: any) => w.message).join('; ')
    } catch {
      warningMsg = ''
    }

    const values = [
      escapeCsv(row.bond_code || ''),
      escapeCsv(row.bond_name || ''),
      row.face_value ?? '',
      row.quantity ?? '',
      row.discount_rate ?? '',
      row.discount_amount ?? '',
      escapeCsv(row.conclusion || ''),
      escapeCsv(warningMsg),
      escapeCsv(row.review_status || ''),
      escapeCsv(row.direction || ''),
      escapeCsv(row.counterparty || ''),
      row.amount ?? '',
      row.term ?? '',
    ]
    lines.push(values.join(','))
  }

  const csv = '\uFEFF' + lines.join('\n')
  const filename = `折算结果_${batch.name}_${batch.date}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
  res.send(csv)

  const allReviewed = (db.prepare(
    "SELECT COUNT(*) as count FROM review_records WHERE batch_id = ? AND status != '已复核'"
  ).get(batchId) as any).count === 0

  if (allReviewed) {
    db.prepare("UPDATE batches SET status = 'exported' WHERE id = ?").run(batchId)
  }
})

export default router
