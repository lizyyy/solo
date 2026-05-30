import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { calculateRiskRate } from '../services/riskCalculator.js'
import { BusinessError } from '../errors.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const db = getDb()
  const { search, risk_level, page = '1', pageSize = '20' } = req.query

  const conditions: string[] = []
  const params: any[] = []

  if (search) {
    conditions.push('(c.name LIKE ? OR c.account LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (risk_level) {
    conditions.push('c.risk_level = ?')
    params.push(risk_level)
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  const pageNum = Number(page)
  const pageSizeNum = Number(pageSize)
  const offset = (pageNum - 1) * pageSizeNum

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM clients c ${where}`).get(...params) as any).cnt
  const data = db.prepare(`
    SELECT c.* FROM clients c ${where}
    ORDER BY c.risk_rate DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSizeNum, offset)

  res.json({ success: true, data: { items: data, total, page: pageNum, pageSize: pageSizeNum } })
})

router.get('/:id', (req: Request, res: Response): void => {
  const db = getDb()
  const { id } = req.params

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any
  if (!client) {
    throw new BusinessError(`客户ID ${id} 不存在`, { severity: 'error' })
  }

  const positions = db.prepare(`
    SELECT p.*, c.code as contract_code, c.name as contract_name
    FROM positions p
    LEFT JOIN contracts c ON c.id = p.contract_id
    WHERE p.client_id = ?
  `).all(id)

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE client_id = ? ORDER BY created_at DESC
  `).all(id)

  const deposits = db.prepare(`
    SELECT * FROM deposits WHERE client_id = ? ORDER BY deposit_time DESC
  `).all(id)

  res.json({ success: true, data: { client, positions, notifications, deposits } })
})

router.get('/:id/risk', (req: Request, res: Response): void => {
  const { id } = req.params
  const result = calculateRiskRate(id)
  res.json({ success: true, data: result })
})

export default router
