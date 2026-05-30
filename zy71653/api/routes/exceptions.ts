import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { runAllChecks } from '../services/exceptionDetector.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { type, severity, status } = req.query

  let sql = 'SELECT * FROM exceptions WHERE 1=1'
  const params: any[] = []

  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }
  if (severity) {
    sql += ' AND severity = ?'
    params.push(severity)
  }
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }

  sql += ' ORDER BY created_at DESC'

  const exceptions = db.prepare(sql).all(...params)
  const transformed = exceptions.map((e: any) => ({
    ...e,
    severity: e.severity === 'high' ? 'critical' : e.severity === 'medium' ? 'warning' : 'info',
  }))
  res.json({ success: true, data: transformed })
})

router.post('/detect', (_req: Request, res: Response): void => {
  const results = runAllChecks()
  res.json({ success: true, data: results })
})

router.post('/:id/action', (req: Request, res: Response): void => {
  const { id } = req.params
  const { action, note, actor } = req.body

  if (!action) {
    res.status(400).json({ success: false, error: '操作类型为必填项' })
    return
  }

  const exception = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(id) as any
  if (!exception) {
    res.status(404).json({ success: false, error: '异常记录不存在' })
    return
  }

  const now = new Date().toISOString()
  const actionId = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO exception_actions (id, exception_id, action, note, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(actionId, id, action, note || null, actor || 'system', now)

    let resolution = ''
    switch (action) {
      case 'rollback':
        resolution = '已回退分配'
        break
      case 'supplement':
        resolution = '已追加预算'
        break
      case 'confirm':
        resolution = '已人工确认'
        break
      case 'dismiss':
        resolution = '已忽略'
        break
      default:
        resolution = action
    }

    db.prepare(`
      UPDATE exceptions SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution = ?
      WHERE id = ?
    `).run(now, actor || 'system', resolution, id)
  })

  transaction()

  const updated = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(id)
  res.json({ success: true, data: updated })
})

router.get('/stats', (_req: Request, res: Response): void => {
  const total = db.prepare('SELECT COUNT(*) as count FROM exceptions').get() as any
  const open = db.prepare("SELECT COUNT(*) as count FROM exceptions WHERE status = 'open'").get() as any
  const resolved = db.prepare("SELECT COUNT(*) as count FROM exceptions WHERE status = 'resolved'").get() as any

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count FROM exceptions GROUP BY type
  `).all() as any[]

  const bySeverity = db.prepare(`
    SELECT severity, COUNT(*) as count FROM exceptions GROUP BY severity
  `).all() as any[]

  res.json({
    success: true,
    data: {
      total: total.count,
      open: open.count,
      resolved: resolved.count,
      byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
      bySeverity: Object.fromEntries(bySeverity.map(r => [r.severity, r.count])),
    },
  })
})

export default router
