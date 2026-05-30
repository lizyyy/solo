import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import type { Warning } from '../types.js'

const router = Router()

router.post('/:id/process', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) {
    res.status(404).json({ success: false, error: 'Batch not found' })
    return
  }

  const collaterals = db.prepare('SELECT * FROM collaterals WHERE batch_id = ?').all(batchId) as any[]
  const trades = db.prepare('SELECT * FROM trades WHERE batch_id = ?').all(batchId) as any[]
  const rates = db.prepare('SELECT * FROM discount_rates WHERE batch_id = ?').all(batchId) as any[]

  const tradeMap = new Map<string, any>()
  for (const t of trades) {
    tradeMap.set(t.id, t)
  }

  const rateMap = new Map<string, any>()
  for (const r of rates) {
    rateMap.set(r.bond_code, r)
  }

  const bondCodeCount = new Map<string, any[]>()
  for (const c of collaterals) {
    if (!bondCodeCount.has(c.bond_code)) {
      bondCodeCount.set(c.bond_code, [])
    }
    bondCodeCount.get(c.bond_code)!.push(c)
  }
  const duplicateBondCodes = new Set<string>()
  for (const [code, items] of bondCodeCount) {
    if (items.length > 1) {
      duplicateBondCodes.add(code)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const insertResult = db.prepare(
    `INSERT INTO process_results (id, batch_id, collateral_id, trade_id, bond_code, discount_rate, discount_amount, conclusion, warnings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertReview = db.prepare(
    `INSERT INTO review_records (id, batch_id, result_id, status) VALUES (?, ?, ?, '待复核')`
  )

  const deleteOldResults = db.prepare('DELETE FROM process_results WHERE batch_id = ?')
  const deleteOldReviews = db.prepare('DELETE FROM review_records WHERE batch_id = ?')
  const updateBatchStatus = db.prepare("UPDATE batches SET status = 'processed' WHERE id = ?")

  const processAll = db.transaction(() => {
    deleteOldResults.run(batchId)
    deleteOldReviews.run(batchId)

    const results: any[] = []

    for (const c of collaterals) {
      const trade = tradeMap.get(c.trade_id)
      const rate = rateMap.get(c.bond_code)

      let discountRate = 0
      let discountAmount = 0
      let conclusion: '通过' | '异常' = '通过'
      const warnings: Warning[] = []

      if (!rate) {
        discountRate = 0
        discountAmount = 0
        conclusion = '异常'
        warnings.push({
          type: '折算率过期',
          message: '未找到折算率',
          affectedTradeIds: [c.trade_id],
          affectedCollateralIds: [c.id],
        })
      } else {
        discountRate = rate.rate
        discountAmount = c.face_value * c.quantity * (rate.rate / 100)

        if (rate.expiry_date < today) {
          conclusion = '异常'
          warnings.push({
            type: '折算率过期',
            message: `折算率已于${rate.expiry_date}过期`,
            affectedTradeIds: [c.trade_id],
            affectedCollateralIds: [c.id],
          })
        }
      }

      if (trade && c.maturity_date < trade.end_date && c.replacement_status !== '已替换') {
        conclusion = '异常'
        warnings.push({
          type: '到期券未替换',
          message: `债券${c.bond_code}到期日${c.maturity_date}早于交易到期日${trade.end_date}且未替换`,
          affectedTradeIds: [c.trade_id],
          affectedCollateralIds: [c.id],
        })
      }

      if (duplicateBondCodes.has(c.bond_code)) {
        const dupItems = bondCodeCount.get(c.bond_code)!
        conclusion = '异常'
        warnings.push({
          type: '同券重复占用',
          message: `债券${c.bond_code}被${dupItems.length}笔质押券占用`,
          affectedTradeIds: dupItems.map((d: any) => d.trade_id),
          affectedCollateralIds: dupItems.map((d: any) => d.id),
        })
      }

      const resultId = uuidv4()
      insertResult.run(
        resultId, batchId, c.id, c.trade_id, c.bond_code,
        discountRate, discountAmount, conclusion, JSON.stringify(warnings)
      )

      insertReview.run(uuidv4(), batchId, resultId)

      results.push({
        id: resultId,
        batchId,
        collateralId: c.id,
        tradeId: c.trade_id,
        bondCode: c.bond_code,
        discountRate,
        discountAmount,
        conclusion,
        warnings,
      })
    }

    updateBatchStatus.run(batchId)
    return results
  })

  const results = processAll()
  res.json({ success: true, data: results })
})

router.get('/:id/results', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const rows = db.prepare('SELECT * FROM process_results WHERE batch_id = ?').all(batchId) as any[]
  const data = rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    collateralId: row.collateral_id,
    tradeId: row.trade_id,
    bondCode: row.bond_code,
    discountRate: row.discount_rate,
    discountAmount: row.discount_amount,
    conclusion: row.conclusion,
    warnings: JSON.parse(row.warnings),
  }))
  res.json({ success: true, data })
})

export default router
