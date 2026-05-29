import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const students = db.prepare('SELECT * FROM students ORDER BY created_at DESC').all()
    res.json({ success: true, data: students })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) as any
    if (!student) {
      res.status(404).json({ success: false, error: '学员不存在' })
      return
    }
    const works = db.prepare(`
      SELECT w.*, GROUP_CONCAT(g.name) AS glaze_names
      FROM works w
      LEFT JOIN work_glazes wg ON wg.work_id = w.id
      LEFT JOIN glazes g ON g.id = wg.glaze_id
      WHERE w.student_id = ?
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `).all(req.params.id)
    student.works = works
    res.json({ success: true, data: student })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, phone = '', notes = '' } = req.body
    if (!name) {
      res.status(400).json({ success: false, error: '学员姓名为必填' })
      return
    }
    const id = uuidv4()
    db.prepare('INSERT INTO students (id, name, phone, notes) VALUES (?, ?, ?, ?)').run(id, name, phone, notes)
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id)
    res.status(201).json({ success: true, data: student })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '学员不存在' })
      return
    }
    const { name, phone, notes } = req.body
    db.prepare('UPDATE students SET name = ?, phone = ?, notes = ? WHERE id = ?').run(
      name ?? existing.name,
      phone ?? existing.phone,
      notes ?? existing.notes,
      req.params.id,
    )
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: student })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ success: false, error: '学员不存在' })
      return
    }
    const workCount = db.prepare('SELECT COUNT(*) as count FROM works WHERE student_id = ?').get(req.params.id) as { count: number }
    if (workCount.count > 0) {
      res.status(400).json({ success: false, error: '该学员下还有作品，无法删除' })
      return
    }
    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
