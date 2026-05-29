import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { transitionWork } from '../services/stateMachine.js'
import { checkConflicts } from '../services/conflictEngine.js'

const router = Router()

router.post('/enqueue', (req: Request, res: Response) => {
  try {
    const { work_id, batch_id, position } = req.body
    if (!work_id || !batch_id) {
      res.status(400).json({ success: false, error: 'work_id 和 batch_id 为必填' })
      return
    }

    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(work_id) as any
    if (!work) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id) as any
    if (!batch) {
      res.status(404).json({ success: false, error: '窑次不存在' })
      return
    }

    if (batch.status !== 'open') {
      res.status(400).json({ success: false, error: '仅 open 状态的窑次可以入队' })
      return
    }

    try {
      transitionWork(work.status, 'queued')
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message })
      return
    }

    const existingEntry = db.prepare('SELECT * FROM queue_entries WHERE work_id = ? AND batch_id = ?').get(work_id, batch_id) as any
    if (existingEntry) {
      res.status(409).json({ success: false, error: '该作品已在此窑次中' })
      return
    }

    const conflicts = checkConflicts(work_id, batch_id)

    const id = uuidv4()
    const now = new Date().toISOString()
    let pos = position
    if (pos == null) {
      const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as max_pos FROM queue_entries WHERE batch_id = ?').get(batch_id) as { max_pos: number }
      pos = maxPos.max_pos + 1
    }

    db.prepare(`
      INSERT INTO queue_entries (id, batch_id, work_id, position, queued_at) VALUES (?, ?, ?, ?, ?)
    `).run(id, batch_id, work_id, pos, now)

    db.prepare("UPDATE works SET status = 'queued', updated_at = ? WHERE id = ?").run(now, work_id)

    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(id)
    res.status(201).json({ success: true, data: { entry, conflicts } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:entryId', (req: Request, res: Response) => {
  try {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.entryId) as any
    if (!entry) {
      res.status(404).json({ success: false, error: '队列条目不存在' })
      return
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(entry.batch_id) as any
    if (batch && batch.status !== 'open') {
      res.status(400).json({ success: false, error: '仅 open 状态的窑次可以出队' })
      return
    }

    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(entry.work_id) as any
    if (work) {
      try {
        transitionWork(work.status, 'pending')
        const now = new Date().toISOString()
        db.prepare("UPDATE works SET status = 'pending', updated_at = ? WHERE id = ?").run(now, entry.work_id)
      } catch (e: any) {
        res.status(400).json({ success: false, error: e.message })
        return
      }
    }

    db.prepare('DELETE FROM queue_entries WHERE id = ?').run(req.params.entryId)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:entryId/position', (req: Request, res: Response) => {
  try {
    const { position } = req.body
    if (position == null || position < 1) {
      res.status(400).json({ success: false, error: '位置必须为正整数' })
      return
    }
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.entryId) as any
    if (!entry) {
      res.status(404).json({ success: false, error: '队列条目不存在' })
      return
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(entry.batch_id) as any
    if (batch && batch.status !== 'open') {
      res.status(400).json({ success: false, error: '仅 open 状态的窑次可以调整顺序' })
      return
    }

    db.prepare('UPDATE queue_entries SET position = ? WHERE id = ?').run(position, req.params.entryId)
    const updated = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(req.params.entryId)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/reschedule', (req: Request, res: Response) => {
  try {
    const { work_id, from_batch_id, to_batch_id, reason = '', operated_by = '' } = req.body
    if (!work_id || !from_batch_id) {
      res.status(400).json({ success: false, error: 'work_id 和 from_batch_id 为必填' })
      return
    }

    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(work_id) as any
    if (!work) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }

    try {
      transitionWork(work.status, 'rescheduled')
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message })
      return
    }

    const fromBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(from_batch_id) as any
    if (fromBatch && fromBatch.status !== 'open') {
      res.status(400).json({ success: false, error: '仅 open 状态的窑次可以改期' })
      return
    }

    const entry = db.prepare('SELECT * FROM queue_entries WHERE work_id = ? AND batch_id = ?').get(work_id, from_batch_id) as any
    if (!entry) {
      res.status(404).json({ success: false, error: '该作品不在指定窑次中' })
      return
    }

    if (to_batch_id) {
      const toBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(to_batch_id) as any
      if (!toBatch) {
        res.status(404).json({ success: false, error: '目标窑次不存在' })
        return
      }
      if (toBatch.status !== 'open') {
        res.status(400).json({ success: false, error: '目标窑次必须为 open 状态' })
        return
      }
    }

    const now = new Date().toISOString()

    db.prepare('DELETE FROM queue_entries WHERE id = ?').run(entry.id)

    const newStatus = to_batch_id ? 'queued' : 'pending'
    db.prepare('UPDATE works SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, work_id)

    if (to_batch_id) {
      const newEntryId = uuidv4()
      const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as max_pos FROM queue_entries WHERE batch_id = ?').get(to_batch_id) as { max_pos: number }
      db.prepare(`
        INSERT INTO queue_entries (id, batch_id, work_id, position, queued_at) VALUES (?, ?, ?, ?, ?)
      `).run(newEntryId, to_batch_id, work_id, maxPos.max_pos + 1, now)
    }

    const logId = uuidv4()
    db.prepare(`
      INSERT INTO reschedule_logs (id, work_id, from_batch_id, to_batch_id, reason, operated_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(logId, work_id, from_batch_id, to_batch_id || null, reason, operated_by, now)

    const log = db.prepare(`
      SELECT rl.*, w.name AS work_name,
        fb.name AS from_batch_name, tb.name AS to_batch_name
      FROM reschedule_logs rl
      LEFT JOIN works w ON w.id = rl.work_id
      LEFT JOIN batches fb ON fb.id = rl.from_batch_id
      LEFT JOIN batches tb ON tb.id = rl.to_batch_id
      WHERE rl.id = ?
    `).get(logId)

    res.json({ success: true, data: log })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
