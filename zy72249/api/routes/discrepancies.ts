import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db, writeAuditLog, updateBatchCounts } from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { batchId, status, type } = req.query

  let sql = 'SELECT * FROM discrepancies WHERE 1=1'
  const params: unknown[] = []

  if (batchId) {
    sql += ' AND batch_id = ?'
    params.push(batchId)
  }
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }

  sql += ' ORDER BY created_at DESC'

  const discrepancies = db.prepare(sql).all(...params)

  const result = discrepancies.map((d: any) => ({
    ...d,
    evidence: d.evidence ? JSON.parse(d.evidence) : null,
    resolution: d.resolution ? JSON.parse(d.resolution) : null,
  }))

  res.json({ success: true, data: result })
})

router.get('/:id', (req: Request, res: Response): void => {
  const discrepancy = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(req.params.id) as any
  if (!discrepancy) {
    res.status(404).json({ success: false, error: '差异记录不存在' })
    return
  }

  let record = null
  if (discrepancy.record_id) {
    record = db.prepare('SELECT * FROM confirmation_records WHERE id = ?').get(discrepancy.record_id)
  }

  res.json({
    success: true,
    data: {
      ...discrepancy,
      evidence: discrepancy.evidence ? JSON.parse(discrepancy.evidence) : null,
      resolution: discrepancy.resolution ? JSON.parse(discrepancy.resolution) : null,
      record,
    },
  })
})

router.post('/:id/resolve', (req: Request, res: Response): void => {
  const { decidedBy, decision, reason } = req.body

  if (!decision || !['confirm_screenshot', 'confirm_remark', 'reject_both'].includes(decision)) {
    res.status(400).json({ success: false, error: '裁决决定无效，必须为 confirm_screenshot / confirm_remark / reject_both' })
    return
  }

  const discrepancy = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(req.params.id) as any
  if (!discrepancy) {
    res.status(404).json({ success: false, error: '差异记录不存在' })
    return
  }

  if (discrepancy.type !== 'conflict') {
    res.status(400).json({ success: false, error: '仅冲突类型差异可裁决' })
    return
  }

  const now = new Date().toISOString()
  const resolution = JSON.stringify({
    decidedBy: decidedBy || 'unknown',
    decision,
    reason: reason || '',
    decidedAt: now,
  })

  db.prepare(`
    UPDATE discrepancies SET status = 'resolved', resolution = ?, updated_at = ? WHERE id = ?
  `).run(resolution, now, req.params.id)

  if (discrepancy.record_id) {
    let newRecordStatus = 'resolved'
    if (decision === 'confirm_screenshot') {
      newRecordStatus = 'resolved'
    } else if (decision === 'confirm_remark') {
      newRecordStatus = 'resolved'
    } else {
      newRecordStatus = 'resolved'
    }
    db.prepare('UPDATE confirmation_records SET status = ? WHERE id = ?').run(newRecordStatus, discrepancy.record_id)
  }

  writeAuditLog(discrepancy.batch_id, 'conflict_resolved', decidedBy || 'unknown', 'fund_accountant', {
    discrepancyId: req.params.id,
    businessNo: discrepancy.business_no,
    decision,
    reason,
  })

  updateBatchCounts(discrepancy.batch_id)

  const updated = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(req.params.id) as any
  res.json({
    success: true,
    data: {
      ...updated,
      evidence: updated.evidence ? JSON.parse(updated.evidence) : null,
      resolution: updated.resolution ? JSON.parse(updated.resolution) : null,
    },
  })
})

router.post('/compare', (req: Request, res: Response): void => {
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

  const records = db.prepare('SELECT * FROM confirmation_records WHERE batch_id = ?').all(batchId) as any[]
  const insertDiscrepancy = db.prepare(`
    INSERT INTO discrepancies (id, batch_id, business_no, record_id, type, severity, description, evidence, status, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  const newDiscrepancies: unknown[] = []

  const transaction = db.transaction(() => {
    const businessNoMap = new Map<string, any[]>()
    for (const r of records) {
      const existing = businessNoMap.get(r.business_no) || []
      existing.push(r)
      businessNoMap.set(r.business_no, existing)
    }

    for (const [businessNo, group] of businessNoMap) {
      const existingDisc = db.prepare('SELECT id FROM discrepancies WHERE batch_id = ? AND business_no = ?').get(batchId, businessNo) as any
      if (existingDisc) continue

      if (group.length > 1) {
        const hasFee = group.some((r: any) => r.fee_amount !== null && r.fee_amount > 0)
        const hasPrincipal = group.some((r: any) => r.principal_amount !== null && r.principal_amount > 0)

        if (hasFee && hasPrincipal) {
          const discId = uuidv4()
          const totalAmount = group.reduce((sum: number, r: any) => sum + (r.amount || 0), 0)
          insertDiscrepancy.run(
            discId, batchId, businessNo, null, 'split_records', 'warning',
            `业务号${businessNo}在确认书中拆分为手续费行和本金行，合计金额${totalAmount}，需结算主管复核`,
            JSON.stringify({
              confirmationData: {
                businessNo,
                lines: group.map((r: any) => ({
                  amount: r.amount,
                  feeAmount: r.fee_amount,
                  principalAmount: r.principal_amount,
                })),
              },
            }),
            'open', null, now, now
          )
          newDiscrepancies.push({ id: discId, businessNo, type: 'split_records' })

          for (const r of group) {
            db.prepare("UPDATE confirmation_records SET type = 'fee_principal_split', status = 'pending_review' WHERE id = ?").run(r.id)
          }

          writeAuditLog(batchId, 'discrepancy_detected', 'system', 'fund_accountant', {
            businessNo, type: 'split_records', severity: 'warning',
          })
        }
      } else {
        const record = group[0]
        if (record.tax_rate_remark && record.ex_dividend_date) {
          const remarkMatch = record.tax_rate_remark.match(/除权日[：:]?\s*(\d{4}-\d{2}-\d{2})/)
          if (remarkMatch && remarkMatch[1] !== record.ex_dividend_date) {
            const discId = uuidv4()
            insertDiscrepancy.run(
              discId, batchId, businessNo, record.id, 'conflict', 'critical',
              `除权日截图显示${record.ex_dividend_date}，但税费率备注显示${remarkMatch[1]}，存在冲突需人工裁决`,
              JSON.stringify({
                confirmationData: { businessNo, exDividendDate: record.ex_dividend_date, source: '除权日截图' },
                taxRemarkData: { businessNo, exDividendDate: remarkMatch[1], source: '税费率备注' },
              }),
              'conflict_pending', null, now, now
            )
            newDiscrepancies.push({ id: discId, businessNo, type: 'conflict' })

            db.prepare("UPDATE confirmation_records SET status = 'conflict' WHERE id = ?").run(record.id)

            writeAuditLog(batchId, 'conflict_detected', 'system', 'fund_accountant', {
              businessNo, type: 'conflict', severity: 'critical',
              screenshotDate: record.ex_dividend_date, remarkDate: remarkMatch[1],
            })
          }
        }

        if (record.caliber_type === 'old' || (record.tax_rate_remark && record.tax_rate_remark.includes('旧口径'))) {
          const existingOldCaliber = db.prepare('SELECT id FROM discrepancies WHERE batch_id = ? AND business_no = ? AND type = ?').get(batchId, businessNo, 'old_caliber') as any
          if (!existingOldCaliber) {
            const discId = uuidv4()
            insertDiscrepancy.run(
              discId, batchId, businessNo, record.id, 'old_caliber', 'info',
              `业务号${businessNo}税费率备注含旧口径数据，需补录`,
              JSON.stringify({
                taxRemarkData: { businessNo, taxRateRemark: record.tax_rate_remark, caliberType: 'old' },
              }),
              'open', null, now, now
            )
            newDiscrepancies.push({ id: discId, businessNo, type: 'old_caliber' })

            writeAuditLog(batchId, 'old_caliber_detected', 'system', 'fund_accountant', {
              businessNo, type: 'old_caliber',
            })
          }
        }
      }
    }

    updateBatchCounts(batchId)

    db.prepare("UPDATE batches SET status = 'reviewing' WHERE id = ?").run(batchId)

    writeAuditLog(batchId, 'comparison_triggered', 'system', 'fund_accountant', {
      newDiscrepanciesCount: newDiscrepancies.length,
    })
  })

  transaction()

  res.json({
    success: true,
    data: {
      batchId,
      newDiscrepanciesCount: newDiscrepancies.length,
      newDiscrepancies,
    },
  })
})

export default router
