import { getDb } from '../db.js'

export function getRiskLevel(riskRate: number): 'safe' | 'warning' | 'margin_call' | 'force_liquidation' {
  if (riskRate < 100) return 'safe'
  if (riskRate < 130) return 'warning'
  if (riskRate < 150) return 'margin_call'
  return 'force_liquidation'
}

export function calculateRiskRate(clientId: string): {
  equity: number
  marginUsed: number
  riskRate: number
  riskLevel: string
} {
  const db = getDb()

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any
  if (!client) {
    throw new Error(`客户ID ${clientId} 不存在`)
  }

  const positions = db.prepare(`
    SELECT p.*, ms.last_price
    FROM positions p
    LEFT JOIN market_snapshots ms ON ms.contract_id = p.contract_id
    WHERE p.client_id = ?
  `).all(clientId) as any[]

  let equity = 0
  let marginUsed = 0

  for (const pos of positions) {
    marginUsed += pos.margin
    if (pos.last_price) {
      const priceDiff = pos.direction === 'long'
        ? pos.last_price - pos.open_price
        : pos.open_price - pos.last_price
      equity += pos.margin + priceDiff * pos.volume
    } else {
      equity += pos.margin
    }
  }

  const riskRate = marginUsed > 0 ? Math.round((marginUsed / equity) * 10000) / 100 : 0
  const riskLevel = getRiskLevel(riskRate)

  db.prepare(`
    UPDATE clients
    SET equity = ?, margin_used = ?, risk_rate = ?, risk_level = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(equity, marginUsed, riskRate, riskLevel, clientId)

  return { equity, marginUsed, riskRate, riskLevel }
}

export function recalculateAllRiskRates(): void {
  const db = getDb()
  const clients = db.prepare('SELECT id FROM clients').all() as { id: string }[]
  const transaction = db.transaction(() => {
    for (const c of clients) {
      calculateRiskRate(c.id)
    }
  })
  transaction()
}
