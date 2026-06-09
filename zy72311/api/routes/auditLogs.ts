import { Router, type Request, type Response } from 'express'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const db = getDb()
  const { operator, action, from, to, keyword } = req.query as {
    operator?: string
    action?: string
    from?: string
    to?: string
    keyword?: string
  }

  let sql = 'SELECT * FROM audit_logs WHERE 1=1'
  const params: any[] = []

  if (operator) {
    sql += ' AND operator = ?'
    params.push(operator)
  }
  if (action) {
    sql += ' AND action = ?'
    params.push(action)
  }
  if (from) {
    sql += ' AND created_at >= ?'
    params.push(from)
  }
  if (to) {
    sql += ' AND created_at <= ?'
    params.push(to)
  }
  if (keyword) {
    const kw = `%${keyword}%`
    sql += ' AND (reason LIKE ? OR operator LIKE ? OR target_type LIKE ? OR before_value LIKE ? OR after_value LIKE ?)'
    params.push(kw, kw, kw, kw, kw)
  }

  sql += ' ORDER BY created_at DESC'

  const logs = db.prepare(sql).all(...params)

  res.json({ success: true, data: { logs, total: logs.length } })
})

export default router
