import { Router, type Request, type Response } from 'express'
import { db, writeAuditLog } from '../database.js'

const router = Router()

router.get('/audit-logs', (req: Request, res: Response): void => {
  const { batchId, action } = req.query

  let sql = 'SELECT * FROM audit_logs WHERE 1=1'
  const params: unknown[] = []

  if (batchId) {
    sql += ' AND batch_id = ?'
    params.push(batchId)
  }
  if (action) {
    sql += ' AND action = ?'
    params.push(action)
  }

  sql += ' ORDER BY timestamp DESC'

  const logs = db.prepare(sql).all(...params)

  const result = logs.map((log: any) => ({
    ...log,
    detail: log.detail ? JSON.parse(log.detail) : null,
  }))

  res.json({ success: true, data: result })
})

router.get('/replay-command/:batchId', (req: Request, res: Response): void => {
  const { batchId } = req.params

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' })
    return
  }

  const records = db.prepare('SELECT * FROM confirmation_records WHERE batch_id = ?').all(batchId) as any[]
  const discrepancies = db.prepare('SELECT * FROM discrepancies WHERE batch_id = ?').all(batchId) as any[]

  const importPayload = records.map((r: any) => ({
    businessNo: r.business_no,
    exDividendDate: r.ex_dividend_date,
    amount: r.amount,
    feeAmount: r.fee_amount,
    principalAmount: r.principal_amount,
    taxRate: r.tax_rate,
    taxRateRemark: r.tax_rate_remark,
    caliberType: r.caliber_type,
    source: r.source,
  }))

  const resolvedConflicts = discrepancies
    .filter((d: any) => d.type === 'conflict' && d.resolution)
    .map((d: any) => ({
      discrepancyId: d.id,
      businessNo: d.business_no,
      resolution: d.resolution ? JSON.parse(d.resolution) : null,
    }))

  const baseUrl = process.env.BASE_URL || 'http://localhost:3001'

  const importCommand = `curl -X POST ${baseUrl}/api/records/import \\
  -H "Content-Type: application/json" \\
  -d '{"batchId":"${batchId}","records":${JSON.stringify(importPayload)}}'`

  const compareCommand = `curl -X POST ${baseUrl}/api/discrepancies/compare \\
  -H "Content-Type: application/json" \\
  -d '{"batchId":"${batchId}"}'`

  let resolveCommands = ''
  if (resolvedConflicts.length > 0) {
    resolveCommands = resolvedConflicts.map((c: any) => {
      const res = c.resolution
      return `curl -X POST ${baseUrl}/api/discrepancies/${c.discrepancyId}/resolve \\
  -H "Content-Type: application/json" \\
  -d '{"decidedBy":"${res.decidedBy}","decision":"${res.decision}","reason":"${res.reason}"}'`
    }).join('\n\n')
  }

  const fullCommand = [importCommand, compareCommand, resolveCommands].filter(Boolean).join('\n\n')

  res.json({
    success: true,
    data: {
      batchId,
      batchName: (batch as any).name,
      commands: {
        import: importCommand,
        compare: compareCommand,
        resolve: resolveCommands || null,
      },
      fullCommand,
      generatedAt: new Date().toISOString(),
    },
  })
})

router.post('/replay-command/execute', (req: Request, res: Response): void => {
  const { batchId } = req.body

  if (!batchId) {
    res.status(400).json({ success: false, error: '批次ID不能为空' })
    return
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' })
    return
  }

  writeAuditLog(batchId, 'replay_executed', 'system', 'fund_accountant', {
    executedAt: new Date().toISOString(),
  })

  const records = db.prepare('SELECT * FROM confirmation_records WHERE batch_id = ?').all(batchId) as any[]

  const importPayload = records.map((r: any) => ({
    businessNo: r.business_no,
    exDividendDate: r.ex_dividend_date,
    amount: r.amount,
    feeAmount: r.fee_amount,
    principalAmount: r.principal_amount,
    taxRate: r.tax_rate,
    taxRateRemark: r.tax_rate_remark,
    caliberType: r.caliber_type,
    source: r.source,
  }))

  writeAuditLog(batchId, 'replay_import_started', 'system', 'fund_accountant', {
    recordCount: importPayload.length,
  })

  writeAuditLog(batchId, 'replay_compare_started', 'system', 'fund_accountant', {
    batchId,
  })

  res.json({
    success: true,
    data: {
      message: '复盘命令已执行',
      batchId,
      recordCount: importPayload.length,
      executedAt: new Date().toISOString(),
    },
  })
})

export default router
