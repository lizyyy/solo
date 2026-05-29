import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { canTransitionBatch, transitionBatch } from '../services/stateMachine.js'
import { getBatchConflicts } from '../services/conflictEngine.js'

import { generateReport } from './reports.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const batches = db.prepare(`
      SELECT b.*,
        COUNT(qe.id) AS work_count
      FROM batches b
      LEFT JOIN queue_entries qe ON qe.batch_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all() as any[]

    for (const batch of batches) {
      const conflicts = getBatchConflicts(batch.id)
      batch.conflict_count = conflicts.length
    }

    res.json({ success: true, data: batches })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
    if (!batch) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }
    const entries = db.prepare(`
      SELECT qe.*, w.name AS work_name, w.width, w.height, w.depth, w.status AS work_status,
        s.name AS student_name,
        GROUP_CONCAT(g.name) AS glaze_names
      FROM queue_entries qe
      JOIN works w ON w.id = qe.work_id
      LEFT JOIN students s ON s.id = w.student_id
      LEFT JOIN work_glazes wg ON wg.work_id = w.id
      LEFT JOIN glazes g ON g.id = wg.glaze_id
      WHERE qe.batch_id = ?
      GROUP BY qe.id
      ORDER BY qe.position
    `).all(req.params.id)
    batch.entries = entries
    batch.conflicts = getBatchConflicts(batch.id)
    res.json({ success: true, data: batch })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, kiln_name = '1号窑', max_width = 60, max_height = 40, max_depth = 60 } = req.body
    if (!name) {
      res.status(400).json({ success: false, error: '窑次名称为必填' })
      return
    }
    const id = uuidv4()
    db.prepare(`
      INSERT INTO batches (id, name, kiln_name, max_width, max_height, max_depth)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, kiln_name, max_width, max_height, max_depth)
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(id)
    res.status(201).json({ success: true, data: batch })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }
    if (existing.status !== 'open') {
      res.status(400).json({ success: false, error: '仅 open 状态的窑次可以编辑' })
      return
    }
    const { name, kiln_name, max_width, max_height, max_depth } = req.body
    db.prepare(`
      UPDATE batches SET name = ?, kiln_name = ?, max_width = ?, max_height = ?, max_depth = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      kiln_name ?? existing.kiln_name,
      max_width ?? existing.max_width,
      max_height ?? existing.max_height,
      max_depth ?? existing.max_depth,
      req.params.id,
    )
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: batch })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:id/lock', (req: Request, res: Response) => {
  try {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
    if (!batch) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }
    transitionBatch(batch.status, 'locked')
    db.prepare("UPDATE batches SET status = 'locked' WHERE id = ?").run(req.params.id)
    const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.post('/:id/unlock', (req: Request, res: Response) => {
  try {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
    if (!batch) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }
    if (batch.status === 'firing') {
      res.status(400).json({ success: false, error: '烧制中的窑次无法解锁' })
      return
    }
    if (!canTransitionBatch(batch.status, 'open')) {
      res.status(400).json({ success: false, error: `不允许从 "${batch.status}" 解锁` })
      return
    }
    db.prepare("UPDATE batches SET status = 'open' WHERE id = ?").run(req.params.id)
    const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.post('/:id/fire', (req: Request, res: Response) => {
  try {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
    if (!batch) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }
    transitionBatch(batch.status, 'firing')
    const now = new Date().toISOString()
    db.prepare("UPDATE batches SET status = 'firing', fired_at = ? WHERE id = ?").run(now, req.params.id)

    const entries = db.prepare('SELECT work_id FROM queue_entries WHERE batch_id = ?').all(req.params.id) as { work_id: string }[]
    const updateWork = db.prepare("UPDATE works SET status = 'firing', updated_at = ? WHERE id = ?")
    const updateMany = db.transaction((workIds: string[]) => {
      for (const wid of workIds) updateWork.run(now, wid)
    })
    updateMany(entries.map(e => e.work_id))

    const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
    if (!batch) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }
    transitionBatch(batch.status, 'completed')
    const now = new Date().toISOString()
    db.prepare("UPDATE batches SET status = 'completed', completed_at = ? WHERE id = ?").run(now, req.params.id)

    const entries = db.prepare('SELECT work_id FROM queue_entries WHERE batch_id = ?').all(req.params.id) as { work_id: string }[]
    const updateWork = db.prepare("UPDATE works SET status = 'completed', updated_at = ? WHERE id = ?")
    const updateMany = db.transaction((workIds: string[]) => {
      for (const wid of workIds) updateWork.run(now, wid)
    })
    updateMany(entries.map(e => e.work_id))

    const updated = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.post('/:id/generate-report', (req: Request, res: Response) => {
  try {
    const report = generateReport(req.params.id)
    res.status(201).json({ success: true, data: report })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
