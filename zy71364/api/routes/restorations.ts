import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

function toCamelCase(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}

router.get('/', (req: Request, res: Response): void => {
  const rows = db.prepare('SELECT * FROM restorations ORDER BY created_at DESC').all() as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.get('/:id', (req: Request, res: Response): void => {
  const row = db.prepare('SELECT * FROM restorations WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }
  res.json({ success: true, data: toCamelCase(row) })
})

router.post('/', (req: Request, res: Response): void => {
  const { artworkId, restorerName, status, startDate, endDate } = req.body
  if (!artworkId || !restorerName || !startDate) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const artwork = db.prepare('SELECT id FROM artworks WHERE id = ?').get(artworkId)
  if (!artwork) {
    res.status(404).json({ success: false, error: '关联作品不存在' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO restorations (id, artwork_id, restorer_name, status, start_date, end_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, artworkId, restorerName, status || 'draft', startDate, endDate || null, now, now)

  const row = db.prepare('SELECT * FROM restorations WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.put('/:id', (req: Request, res: Response): void => {
  const existing = db.prepare('SELECT * FROM restorations WHERE id = ?').get(req.params.id)
  if (!existing) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const { restorerName, status, startDate, endDate } = req.body
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE restorations SET
      restorer_name = COALESCE(?, restorer_name),
      status = COALESCE(?, status),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      updated_at = ?
    WHERE id = ?
  `).run(restorerName, status, startDate, endDate, now, req.params.id)

  const row = db.prepare('SELECT * FROM restorations WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json({ success: true, data: toCamelCase(row) })
})

router.get('/:id/steps', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const rows = db.prepare('SELECT * FROM restoration_steps WHERE restoration_id = ? ORDER BY step_order').all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.post('/:id/steps', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const { stepOrder, type, description, notes, performedAt } = req.body
  if (!type || !description || !performedAt) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const maxOrder = db.prepare('SELECT MAX(step_order) as max_order FROM restoration_steps WHERE restoration_id = ?').get(req.params.id) as { max_order: number | null }
  const order = stepOrder ?? (maxOrder.max_order ?? 0) + 1

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO restoration_steps (id, restoration_id, step_order, type, description, notes, performed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, order, type, description, notes || '', performedAt, now)

  const row = db.prepare('SELECT * FROM restoration_steps WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.put('/:id/steps/:stepId', (req: Request, res: Response): void => {
  const step = db.prepare('SELECT * FROM restoration_steps WHERE id = ? AND restoration_id = ?').get(req.params.stepId, req.params.id)
  if (!step) {
    res.status(404).json({ success: false, error: '步骤不存在' })
    return
  }

  const { stepOrder, type, description, notes, performedAt } = req.body

  db.prepare(`
    UPDATE restoration_steps SET
      step_order = COALESCE(?, step_order),
      type = COALESCE(?, type),
      description = COALESCE(?, description),
      notes = COALESCE(?, notes),
      performed_at = COALESCE(?, performed_at)
    WHERE id = ?
  `).run(stepOrder, type, description, notes, performedAt, req.params.stepId)

  const row = db.prepare('SELECT * FROM restoration_steps WHERE id = ?').get(req.params.stepId) as Record<string, unknown>
  res.json({ success: true, data: toCamelCase(row) })
})

router.put('/:id/steps/reorder', (req: Request, res: Response): void => {
  const body = req.body
  let stepOrders: { stepId: string; stepOrder: number }[]

  if (Array.isArray(body)) {
    stepOrders = body.map((stepId: string, index: number) => ({ stepId, stepOrder: index + 1 }))
  } else if (Array.isArray(body.stepOrders)) {
    stepOrders = body.stepOrders
  } else {
    res.status(400).json({ success: false, error: 'stepOrders 必须为数组' })
    return
  }

  const updateStep = db.prepare('UPDATE restoration_steps SET step_order = ? WHERE id = ? AND restoration_id = ?')
  const reorder = db.transaction(() => {
    for (const item of stepOrders) {
      updateStep.run(item.stepOrder, item.stepId, req.params.id)
    }
  })
  reorder()

  const rows = db.prepare('SELECT * FROM restoration_steps WHERE restoration_id = ? ORDER BY step_order').all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

export default router
