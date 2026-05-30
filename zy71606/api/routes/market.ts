import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

router.get('/snapshot', (req: Request, res: Response): void => {
  const db = getDb()

  const snapshots = db.prepare(`
    SELECT ms.id, ms.contract_id, ms.last_price, ms.change_pct, ms.snapshot_time, ms.source,
           c.code as contract_code, c.name as contract_name, c.exchange
    FROM market_snapshots ms
    LEFT JOIN contracts c ON c.id = ms.contract_id
    ORDER BY ms.snapshot_time DESC
  `).all()

  const seen = new Set<string>()
  const latest: any[] = []
  for (const s of snapshots as any[]) {
    if (!seen.has(s.contract_id)) {
      seen.add(s.contract_id)
      latest.push({
        id: s.id,
        contract_id: s.contract_id,
        last_price: s.last_price,
        change_pct: s.change_pct,
        snapshot_time: s.snapshot_time,
        source: s.source,
        contract: {
          id: s.contract_id,
          code: s.contract_code,
          name: s.contract_name,
          exchange: s.exchange,
        },
      })
    }
  }

  res.json({ success: true, data: latest })
})

router.post('/import', (req: Request, res: Response): void => {
  const db = getDb()
  const { snapshots } = req.body as { snapshots: Array<{ contractId: string; lastPrice: number; changePct?: number; snapshotTime?: string }> }

  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    res.status(400).json({ success: false, error: '请提供行情数据数组' })
    return
  }

  const inserted: any[] = []
  const errors: string[] = []

  const transaction = db.transaction(() => {
    for (const s of snapshots) {
      const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(s.contractId) as any
      if (!contract) {
        errors.push(`合约ID ${s.contractId} 不存在`)
        continue
      }
      const id = uuidv4()
      db.prepare(`
        INSERT INTO market_snapshots (id, contract_id, last_price, change_pct, snapshot_time, source)
        VALUES (?, ?, ?, ?, ?, 'manual')
      `).run(id, s.contractId, s.lastPrice, s.changePct || 0, s.snapshotTime || new Date().toISOString())
      inserted.push({ id, contractId: s.contractId })
    }
  })
  transaction()

  res.json({ success: true, data: { inserted: inserted.length, errors } })
})

export default router
