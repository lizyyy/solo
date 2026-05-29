import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/glazes', (_req: Request, res: Response) => {
  try {
    const glazes = db.prepare('SELECT * FROM glazes ORDER BY name').all()
    res.json({ success: true, data: glazes })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/glazes', (req: Request, res: Response) => {
  try {
    const { name, firing_temp, color = '', notes = '' } = req.body
    if (!name || firing_temp == null) {
      res.status(400).json({ success: false, error: '釉料名称和烧成温度为必填' })
      return
    }
    const id = uuidv4()
    db.prepare('INSERT INTO glazes (id, name, firing_temp, color, notes) VALUES (?, ?, ?, ?, ?)').run(id, name, firing_temp, color, notes)
    const glaze = db.prepare('SELECT * FROM glazes WHERE id = ?').get(id)
    res.status(201).json({ success: true, data: glaze })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/glazes/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM glazes WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '釉料不存在' })
      return
    }
    const { name, firing_temp, color, notes } = req.body
    db.prepare('UPDATE glazes SET name = ?, firing_temp = ?, color = ?, notes = ? WHERE id = ?').run(
      name ?? existing.name,
      firing_temp ?? existing.firing_temp,
      color ?? existing.color,
      notes ?? existing.notes,
      req.params.id,
    )
    const glaze = db.prepare('SELECT * FROM glazes WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: glaze })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/glazes/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM glazes WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ success: false, error: '釉料不存在' })
      return
    }
    const workCount = db.prepare('SELECT COUNT(*) as count FROM work_glazes WHERE glaze_id = ?').get(req.params.id) as { count: number }
    if (workCount.count > 0) {
      res.status(400).json({ success: false, error: '该釉料仍被作品使用，无法删除' })
      return
    }
    db.prepare('DELETE FROM glaze_conflicts WHERE glaze_a_id = ? OR glaze_b_id = ?').run(req.params.id, req.params.id)
    db.prepare('DELETE FROM glazes WHERE id = ?').run(req.params.id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/glaze-conflicts', (_req: Request, res: Response) => {
  try {
    const conflicts = db.prepare(`
      SELECT gc.*, ga.name AS glaze_a_name, gb.name AS glaze_b_name
      FROM glaze_conflicts gc
      LEFT JOIN glazes ga ON ga.id = gc.glaze_a_id
      LEFT JOIN glazes gb ON gb.id = gc.glaze_b_id
    `).all()
    res.json({ success: true, data: conflicts })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/glaze-conflicts', (req: Request, res: Response) => {
  try {
    const { glaze_a_id, glaze_b_id, reason = '釉料冲突' } = req.body
    if (!glaze_a_id || !glaze_b_id) {
      res.status(400).json({ success: false, error: '需要两个釉料ID' })
      return
    }
    const id = uuidv4()
    db.prepare('INSERT INTO glaze_conflicts (id, glaze_a_id, glaze_b_id, reason) VALUES (?, ?, ?, ?)').run(id, glaze_a_id, glaze_b_id, reason)
    const conflict = db.prepare(`
      SELECT gc.*, ga.name AS glaze_a_name, gb.name AS glaze_b_name
      FROM glaze_conflicts gc
      LEFT JOIN glazes ga ON ga.id = gc.glaze_a_id
      LEFT JOIN glazes gb ON gb.id = gc.glaze_b_id
      WHERE gc.id = ?
    `).get(id)
    res.status(201).json({ success: true, data: conflict })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: '该釉料冲突规则已存在' })
      return
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/glaze-conflicts/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM glaze_conflicts WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ success: false, error: '冲突规则不存在' })
      return
    }
    db.prepare('DELETE FROM glaze_conflicts WHERE id = ?').run(req.params.id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
