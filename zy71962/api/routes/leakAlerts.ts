import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb()

    const conditions: string[] = []
    const params: unknown[] = []

    if (req.query.isResolved !== undefined) {
      conditions.push('is_resolved = ?')
      params.push(req.query.isResolved === 'true' ? 1 : 0)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const alerts = db.prepare(`SELECT * FROM leak_alerts ${where} ORDER BY detected_at DESC`).all(...params)

    const mapped = alerts.map((row: any) => ({
      id: row.id,
      featureName: row.feature_name,
      source: row.source,
      description: row.description,
      nextStep: row.next_step,
      responsiblePerson: row.responsible_person,
      isResolved: row.is_resolved === 1,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at,
    }))

    res.json({ success: true, data: mapped })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/:id/resolve', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { operator } = req.body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM leak_alerts WHERE id = ?').get(id) as any

    if (!existing) {
      res.status(404).json({ success: false, error: '告警不存在' })
      return
    }

    if (existing.is_resolved === 1) {
      res.status(400).json({ success: false, error: '该告警已处理' })
      return
    }

    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      db.prepare('UPDATE leak_alerts SET is_resolved = 1, resolved_at = ? WHERE id = ?').run(now, id)

      db.prepare(`
        INSERT INTO audit_logs (id, operation_type, operator, target_feature_id, target_feature_name, before_value, after_value, reason, filter_snapshot, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), 'correction', operator || 'system', null, existing.feature_name,
        JSON.stringify({ isResolved: false }),
        JSON.stringify({ isResolved: true, resolvedAt: now }),
        `处理泄漏告警: ${existing.feature_name}`,
        null, now,
      )
    })

    transaction()

    const updated = db.prepare('SELECT * FROM leak_alerts WHERE id = ?').get(id) as any

    res.json({
      success: true,
      data: {
        id: updated.id,
        featureName: updated.feature_name,
        source: updated.source,
        description: updated.description,
        nextStep: updated.next_step,
        responsiblePerson: updated.responsible_person,
        isResolved: updated.is_resolved === 1,
        detectedAt: updated.detected_at,
        resolvedAt: updated.resolved_at,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
