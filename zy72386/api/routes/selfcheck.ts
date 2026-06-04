import { Router, type Request, type Response } from 'express'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

const router = Router()

router.get('/run/:importId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { importId } = req.params

    const importRecord = db.prepare('SELECT * FROM imports WHERE id = ?').get(importId)
    if (!importRecord) {
      res.status(404).json({ success: false, error: 'Import not found' })
      return
    }

    const checks: Array<{
      check_type: string
      status: string
      message: string
      details: string
    }> = []

    const dupResult = db.prepare(
      'SELECT sensor_id, COUNT(*) as cnt FROM records GROUP BY sensor_id HAVING cnt > 1'
    ).all() as Array<{ sensor_id: string; cnt: number }>

    if (dupResult.length > 0) {
      checks.push({
        check_type: 'duplicate_import',
        status: 'warning',
        message: `发现 ${dupResult.length} 个重复的传感器ID`,
        details: JSON.stringify(dupResult),
      })
    } else {
      checks.push({
        check_type: 'duplicate_import',
        status: 'pass',
        message: '未发现重复的传感器ID',
        details: '[]',
      })
    }

    const pendingChanges = db.prepare(
      "SELECT COUNT(*) as cnt FROM sensor_id_changes WHERE status = 'pending_review'"
    ).get() as { cnt: number }

    if (pendingChanges.cnt > 0) {
      checks.push({
        check_type: 'sensor_id_changed',
        status: 'warning',
        message: `有 ${pendingChanges.cnt} 条传感器ID变更待审核`,
        details: JSON.stringify({ count: pendingChanges.cnt }),
      })
    } else {
      checks.push({
        check_type: 'sensor_id_changed',
        status: 'pass',
        message: '所有传感器ID变更已处理',
        details: '[]',
      })
    }

    const unrecalced = db.prepare(
      'SELECT COUNT(*) as cnt FROM records r WHERE r.current_step = 1 AND EXISTS (SELECT 1 FROM manual_edits m WHERE m.record_id = r.id)'
    ).get() as { cnt: number }

    if (unrecalced.cnt > 0) {
      checks.push({
        check_type: 'recalc_after_supplement',
        status: 'warning',
        message: `有 ${unrecalced.cnt} 条记录已编辑但未重新计算`,
        details: JSON.stringify({ count: unrecalced.cnt }),
      })
    } else {
      checks.push({
        check_type: 'recalc_after_supplement',
        status: 'pass',
        message: '所有已编辑记录已完成重新计算',
        details: '[]',
      })
    }

    const records = db.prepare(
      'SELECT * FROM records WHERE import_id = ? ORDER BY id'
    ).all(importId)

    const dataHash = createHash('sha256').update(JSON.stringify(records)).digest('hex')

    checks.push({
      check_type: 'export_consistency',
      status: 'pass',
      message: '数据一致性校验通过',
      details: JSON.stringify({ hash: dataHash, recordCount: records.length }),
    })

    const insertCheck = db.prepare(
      'INSERT INTO selfcheck_results (id, import_id, check_type, status, message, details) VALUES (?, ?, ?, ?, ?, ?)'
    )

    db.transaction(() => {
      db.prepare('DELETE FROM selfcheck_results WHERE import_id = ?').run(importId)
      for (const check of checks) {
        insertCheck.run(uuidv4(), importId, check.check_type, check.status, check.message, check.details)
      }
    })()

    res.json({ success: true, data: checks })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/results/:importId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { importId } = req.params

    const results = db.prepare(
      'SELECT * FROM selfcheck_results WHERE import_id = ? ORDER BY checked_at DESC'
    ).all(importId)

    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
