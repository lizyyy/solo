import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { trackId, limit = '20', offset = '0' } = req.query

  let sql = 'SELECT * FROM audit_logs WHERE 1=1'
  const params: unknown[] = []

  if (trackId) {
    sql += ' AND track_id = ?'
    params.push(Number(trackId))
  }

  sql += ' ORDER BY created_at DESC'

  const limitNum = Math.max(1, Math.min(Number(limit) || 20, 100))
  const offsetNum = Number(offset) || 0

  sql += ' LIMIT ? OFFSET ?'
  params.push(limitNum, offsetNum)

  const logs = db.prepare(sql).all(...params)

  let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1'
  const countParams: unknown[] = []
  if (trackId) {
    countSql += ' AND track_id = ?'
    countParams.push(Number(trackId))
  }
  const { total } = db.prepare(countSql).get(...countParams) as { total: number }

  res.json({
    success: true,
    data: logs,
    pagination: {
      total,
      limit: limitNum,
      offset: offsetNum,
    },
  })
})

export default router
