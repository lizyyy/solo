import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const works = db.prepare(`
      SELECT w.*, s.name AS student_name,
        GROUP_CONCAT(g.name) AS glaze_names,
        GROUP_CONCAT(g.id) AS glaze_ids
      FROM works w
      LEFT JOIN students s ON w.student_id = s.id
      LEFT JOIN work_glazes wg ON wg.work_id = w.id
      LEFT JOIN glazes g ON g.id = wg.glaze_id
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `).all()
    res.json({ success: true, data: works })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const work = db.prepare(`
      SELECT w.*, s.name AS student_name, s.phone AS student_phone
      FROM works w
      LEFT JOIN students s ON w.student_id = s.id
      WHERE w.id = ?
    `).get(req.params.id) as any
    if (!work) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }
    const glazes = db.prepare(`
      SELECT g.* FROM glazes g
      JOIN work_glazes wg ON wg.glaze_id = g.id
      WHERE wg.work_id = ?
    `).all(req.params.id)
    work.glazes = glazes
    res.json({ success: true, data: work })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, student_id, glaze_ids = [], width = 0, height = 0, depth = 0 } = req.body
    if (!name || !student_id) {
      res.status(400).json({ success: false, error: '作品名称和学员ID为必填' })
      return
    }
    const id = uuidv4()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO works (id, name, student_id, width, height, depth, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, name, student_id, width, height, depth, now, now)

    const insertGlaze = db.prepare('INSERT OR IGNORE INTO work_glazes (work_id, glaze_id) VALUES (?, ?)')
    const insertMany = db.transaction((ids: string[]) => {
      for (const gid of ids) insertGlaze.run(id, gid)
    })
    insertMany(glaze_ids)

    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(id)
    res.status(201).json({ success: true, data: work })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }
    const { name, student_id, glaze_ids, width, height, depth, status } = req.body
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE works SET name = ?, student_id = ?, width = ?, height = ?, depth = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      student_id ?? existing.student_id,
      width ?? existing.width,
      height ?? existing.height,
      depth ?? existing.depth,
      status ?? existing.status,
      now,
      req.params.id,
    )

    if (glaze_ids !== undefined) {
      db.prepare('DELETE FROM work_glazes WHERE work_id = ?').run(req.params.id)
      const insertGlaze = db.prepare('INSERT OR IGNORE INTO work_glazes (work_id, glaze_id) VALUES (?, ?)')
      const insertMany = db.transaction((ids: string[]) => {
        for (const gid of ids) insertGlaze.run(req.params.id, gid)
      })
      insertMany(glaze_ids)
    }

    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: work })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }
    db.prepare('DELETE FROM work_glazes WHERE work_id = ?').run(req.params.id)
    db.prepare('DELETE FROM works WHERE id = ?').run(req.params.id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id/reschedule-logs', (req: Request, res: Response) => {
  try {
    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id)
    if (!work) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }
    const logs = db.prepare(`
      SELECT rl.*, fb.name AS from_batch_name, tb.name AS to_batch_name
      FROM reschedule_logs rl
      LEFT JOIN batches fb ON fb.id = rl.from_batch_id
      LEFT JOIN batches tb ON tb.id = rl.to_batch_id
      WHERE rl.work_id = ?
      ORDER BY rl.created_at DESC
    `).all(req.params.id)
    res.json({ success: true, data: logs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
