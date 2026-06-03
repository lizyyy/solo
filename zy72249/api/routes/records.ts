import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db, writeAuditLog, updateBatchCounts } from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { batchId, status, type } = req.query

  let sql = 'SELECT * FROM confirmation_records WHERE 1=1'
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

  const records = db.prepare(sql).all(...params)
  res.json({ success: true, data: records })
})

router.get('/:id', (req: Request, res: Response): void => {
  const record = db.prepare('SELECT * FROM confirmation_records WHERE id = ?').get(req.params.id) as any
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const discrepancy = db.prepare('SELECT * FROM discrepancies WHERE record_id = ?').get(req.params.id)

  res.json({
    success: true,
    data: {
      ...record,
      discrepancy: discrepancy || null,
    },
  })
})

router.post('/import', (req: Request, res: Response): void => {
  const { batchId, records } = req.body

  if (!batchId) {
    res.status(400).json({ success: false, error: '批次ID不能为空' })
    return
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' })
    return
  }

  const inputRecords = records || []
  if (!Array.isArray(inputRecords) || inputRecords.length === 0) {
    res.status(400).json({ success: false, error: '导入记录不能为空' })
    return
  }

  const insertRecord = db.prepare(`
    INSERT INTO confirmation_records (id, batch_id, business_no, type, ex_dividend_date, amount, fee_amount, principal_amount, tax_rate, tax_rate_remark, caliber_type, source, status, split_detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertDiscrepancy = db.prepare(`
    INSERT INTO discrepancies (id, batch_id, business_no, record_id, type, severity, description, evidence, status, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const createdRecords: unknown[] = []
  const createdDiscrepancies: unknown[] = []
  const now = new Date().toISOString()

  const transaction = db.transaction(() => {
    const businessNoGroups = new Map<string, unknown[]>()

    for (const r of inputRecords) {
      const id = uuidv4()
      let recordType: string = 'normal'
      let recordStatus: string = 'normal'
      let splitDetail: string | null = null
      let feeAmount: number | null = null
      let principalAmount: number | null = null

      if (r.businessNo) {
        const existing = businessNoGroups.get(r.businessNo) || []
        existing.push(r)
        businessNoGroups.set(r.businessNo, existing)

        if (existing.length > 1) {
          recordType = 'fee_principal_split'
          recordStatus = 'pending_review'
        }
      }

      if (r.isFee && r.isPrincipal) {
        recordType = 'fee_principal_split'
        recordStatus = 'pending_review'
        feeAmount = r.feeAmount || null
        principalAmount = r.principalAmount || null
        splitDetail = JSON.stringify({
          feeLine: { amount: feeAmount || 0, description: '衍生品手续费' },
          principalLine: { amount: principalAmount || 0, description: '衍生品本金' },
        })
      } else if (r.isFee) {
        feeAmount = r.amount || null
      } else if (r.isPrincipal) {
        principalAmount = r.amount || null
      }

      insertRecord.run(
        id, batchId, r.businessNo || '', recordType, r.exDividendDate || null,
        r.amount || 0, feeAmount, principalAmount, r.taxRate || null,
        r.taxRateRemark || null, r.caliberType || 'new', r.source || 'confirmation',
        recordStatus, splitDetail, now
      )

      const created = { id, businessNo: r.businessNo, type: recordType, status: recordStatus }
      createdRecords.push(created)

      writeAuditLog(batchId, 'record_imported', 'system', 'fund_accountant', {
        recordId: id, businessNo: r.businessNo, type: recordType,
      })
    }

    for (const [businessNo, group] of businessNoGroups) {
      if (group.length > 1) {
        const totalAmount = group.reduce((sum: number, r: any) => sum + (r.amount || 0), 0)
        const discId = uuidv4()
        insertDiscrepancy.run(
          discId, batchId, businessNo, null, 'split_records', 'warning',
          `业务号${businessNo}在确认书中拆分为多行，合计金额${totalAmount}，需结算主管复核`,
          JSON.stringify({
            confirmationData: { businessNo, lines: group.map((r: any) => ({ amount: r.amount, type: r.isFee ? 'fee' : 'principal' })) },
          }),
          'open', null, now, now
        )
        createdDiscrepancies.push({ id: discId, businessNo, type: 'split_records' })
        writeAuditLog(batchId, 'discrepancy_detected', 'system', 'fund_accountant', {
          businessNo, type: 'split_records', severity: 'warning',
        })
      }
    }

    updateBatchCounts(batchId)

    db.prepare("UPDATE batches SET status = 'comparing' WHERE id = ? AND status = 'importing'").run(batchId)
  })

  transaction()

  res.status(201).json({
    success: true,
    data: {
      importedCount: createdRecords.length,
      records: createdRecords,
      discrepancies: createdDiscrepancies,
    },
  })
})

router.post('/tax-remark-review', (req: Request, res: Response): void => {
  const { batchId, records } = req.body

  if (!batchId) {
    res.status(400).json({ success: false, error: '批次ID不能为空' })
    return
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' })
    return
  }

  const reviewRecords = records || []
  if (!Array.isArray(reviewRecords) || reviewRecords.length === 0) {
    res.status(400).json({ success: false, error: '补录记录不能为空' })
    return
  }

  const insertDiscrepancy = db.prepare(`
    INSERT INTO discrepancies (id, batch_id, business_no, record_id, type, severity, description, evidence, status, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const updateRecord = db.prepare(`
    UPDATE confirmation_records SET tax_rate_remark = ?, caliber_type = ?, status = ?, source = ? WHERE id = ?
  `)

  const createdDiscrepancies: unknown[] = []
  const now = new Date().toISOString()

  const transaction = db.transaction(() => {
    for (const r of reviewRecords) {
      const existingRecord = db.prepare('SELECT * FROM confirmation_records WHERE id = ?').get(r.recordId) as any
      if (!existingRecord) continue

      if (r.exDividendDate && existingRecord.ex_dividend_date && r.exDividendDate !== existingRecord.ex_dividend_date) {
        const discId = uuidv4()
        insertDiscrepancy.run(
          discId, batchId, existingRecord.business_no, existingRecord.id, 'conflict', 'critical',
          `除权日截图显示${existingRecord.ex_dividend_date}，但税费率备注显示${r.exDividendDate}，存在冲突需人工裁决`,
          JSON.stringify({
            confirmationData: { businessNo: existingRecord.business_no, exDividendDate: existingRecord.ex_dividend_date, source: '除权日截图' },
            taxRemarkData: { businessNo: existingRecord.business_no, exDividendDate: r.exDividendDate, source: '税费率备注', caliberType: r.caliberType || 'old' },
          }),
          'conflict_pending', null, now, now
        )
        createdDiscrepancies.push({ id: discId, businessNo: existingRecord.business_no, type: 'conflict' })

        updateRecord.run(
          r.taxRateRemark || null, r.caliberType || 'old', 'conflict', 'tax_remark', existingRecord.id
        )

        writeAuditLog(batchId, 'conflict_detected', 'system', 'fund_accountant', {
          businessNo: existingRecord.business_no, type: 'conflict', severity: 'critical',
          screenshotDate: existingRecord.ex_dividend_date, remarkDate: r.exDividendDate,
        })
      } else {
        const hasOldCaliber = r.caliberType === 'old' || (r.taxRateRemark && r.taxRateRemark.includes('旧口径'))
        if (hasOldCaliber) {
          updateRecord.run(
            r.taxRateRemark || null, 'old', existingRecord.status === 'pending_review' ? 'pending_review' : existingRecord.status, 'tax_remark', existingRecord.id
          )
          const discId = uuidv4()
          insertDiscrepancy.run(
            discId, batchId, existingRecord.business_no, existingRecord.id, 'old_caliber', 'info',
            `业务号${existingRecord.business_no}税费率备注含旧口径数据，需补录`,
            JSON.stringify({
              taxRemarkData: { businessNo: existingRecord.business_no, taxRateRemark: r.taxRateRemark, caliberType: 'old' },
            }),
            'open', null, now, now
          )
          createdDiscrepancies.push({ id: discId, businessNo: existingRecord.business_no, type: 'old_caliber' })
          writeAuditLog(batchId, 'old_caliber_detected', 'system', 'fund_accountant', {
            businessNo: existingRecord.business_no, type: 'old_caliber',
          })
        } else {
          updateRecord.run(
            r.taxRateRemark || null, r.caliberType || 'new', existingRecord.status, 'tax_remark', existingRecord.id
          )
        }

        writeAuditLog(batchId, 'tax_remark_reviewed', 'system', 'fund_accountant', {
          recordId: existingRecord.id, businessNo: existingRecord.business_no,
        })
      }
    }

    updateBatchCounts(batchId)

    db.prepare("UPDATE batches SET status = 'reviewing' WHERE id = ?").run(batchId)
  })

  transaction()

  res.json({
    success: true,
    data: {
      reviewedCount: reviewRecords.length,
      newDiscrepancies: createdDiscrepancies,
    },
  })
})

export default router
