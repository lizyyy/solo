import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { detectStatusRegression } from '../services/statusTracker.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const status = req.query.status as string
    let rows
    if (status) {
      rows = db.prepare('SELECT * FROM replay_tasks WHERE status = ? ORDER BY created_at DESC').all(status)
    } else {
      rows = db.prepare('SELECT * FROM replay_tasks ORDER BY created_at DESC').all()
    }
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch replay tasks' })
  }
})

router.post('/', (req, res) => {
  try {
    const { callback_ids } = req.body
    if (!Array.isArray(callback_ids) || callback_ids.length === 0) {
      res.status(400).json({ success: false, error: 'callback_ids array is required' })
      return
    }

    const insertStmt = db.prepare(
      'INSERT INTO replay_tasks (id, callback_id, status, idempotency_key, idempotency_check) VALUES (?, ?, ?, ?, ?)'
    )

    const created: any[] = []

    const insertTransaction = db.transaction((ids: string[]) => {
      for (const callbackId of ids) {
        const callback = db.prepare('SELECT * FROM callback_records WHERE id = ?').get(callbackId) as any
        if (!callback) continue

        const existing = db.prepare("SELECT id FROM replay_tasks WHERE callback_id = ? AND status IN ('queued', 'running')").get(callbackId)
        if (existing) continue

        const id = uuidv4()
        const idempotencyKey = `idem_${callback.order_id}_${callback.retry_count + 1}`

        const duplicate = db.prepare(
          "SELECT id FROM callback_records WHERE order_id = ? AND processing_result = 'success' AND id != ?"
        ).get(callback.order_id, callbackId)

        const idempotencyCheck = duplicate ? 'fail' : 'pass'

        insertStmt.run(id, callbackId, 'queued', idempotencyKey, 'skip')
        db.prepare('UPDATE replay_tasks SET idempotency_check = ? WHERE id = ?').run(idempotencyCheck, id)

        created.push({ id, callback_id: callbackId, status: 'queued', idempotency_key: idempotencyKey, idempotency_check: idempotencyCheck })
      }
    })

    insertTransaction(callback_ids)

    res.json({ success: true, data: created })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create replay tasks' })
  }
})

router.post('/:id/execute', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM replay_tasks WHERE id = ?').get(req.params.id) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Replay task not found' })
      return
    }

    if (task.status !== 'queued' && task.status !== 'failed') {
      res.status(400).json({ success: false, error: `Cannot execute task in status: ${task.status}` })
      return
    }

    const callback = db.prepare('SELECT * FROM callback_records WHERE id = ?').get(task.callback_id) as any
    if (!callback) {
      res.status(404).json({ success: false, error: 'Associated callback not found' })
      return
    }

    db.prepare('UPDATE replay_tasks SET status = ? WHERE id = ?').run('running', task.id)

    const statusBefore = callback.order_status

    if (task.idempotency_check === 'fail') {
      db.prepare(
        'UPDATE replay_tasks SET status = ?, result = ?, status_before = ?, executed_at = datetime(\'now\') WHERE id = ?'
      ).run('failed', 'idempotency_check_failed', statusBefore, task.id)
      res.json({ success: false, data: db.prepare('SELECT * FROM replay_tasks WHERE id = ?').get(task.id) })
      return
    }

    const existingCallback = db.prepare(
      'SELECT order_status FROM callback_records WHERE order_id = ? AND processing_result = ? AND id != ? ORDER BY created_at DESC LIMIT 1'
    ).get(callback.order_id, 'success', callback.id) as any

    if (existingCallback) {
      const isRegression = detectStatusRegression(existingCallback.order_status, callback.order_status)
      if (isRegression) {
        db.prepare(
          'UPDATE replay_tasks SET status = ?, result = ?, status_before = ?, status_after = ?, executed_at = datetime(\'now\') WHERE id = ?'
        ).run('failed', 'status_regression_blocked', statusBefore, existingCallback.order_status, task.id)
        res.json({ success: false, data: db.prepare('SELECT * FROM replay_tasks WHERE id = ?').get(task.id) })
        return
      }
    }

    db.prepare(
      'UPDATE replay_tasks SET status = ?, result = ?, status_before = ?, status_after = ?, executed_at = datetime(\'now\') WHERE id = ?'
    ).run('completed', 'success', statusBefore, callback.order_status, task.id)

    res.json({ success: true, data: db.prepare('SELECT * FROM replay_tasks WHERE id = ?').get(task.id) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute replay task' })
  }
})

router.get('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM replay_tasks WHERE id = ?').get(req.params.id)
    if (!task) {
      res.status(404).json({ success: false, error: 'Replay task not found' })
      return
    }
    res.json(task)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch replay task' })
  }
})

export default router
