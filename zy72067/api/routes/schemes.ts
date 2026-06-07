import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const schemes = db.prepare('SELECT * FROM schemes ORDER BY updated_at DESC').all()
  res.json({ success: true, data: schemes })
})

router.get('/:id', (req: Request, res: Response) => {
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(req.params.id)
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }
  res.json({ success: true, data: scheme })
})

router.post('/', (req: Request, res: Response) => {
  const { name, description, warning_threshold, critical_threshold, coordinate_system, temperature_unit } = req.body
  if (!name) {
    res.status(400).json({ success: false, error: '方案名称不能为空' })
    return
  }
  const id = uuidv4()
  db.prepare(`
    INSERT INTO schemes (id, name, description, warning_threshold, critical_threshold, coordinate_system, temperature_unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, description || null,
    warning_threshold ?? 85.0,
    critical_threshold ?? 100.0,
    coordinate_system || 'chip_local',
    temperature_unit || 'celsius'
  )
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: scheme })
})

router.put('/:id/params', (req: Request, res: Response) => {
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(req.params.id) as any
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }
  const { warning_threshold, critical_threshold, coordinate_system, temperature_unit, changed_by, reason } = req.body

  const updates: string[] = []
  const values: any[] = []

  if (warning_threshold !== undefined && warning_threshold !== scheme.warning_threshold) {
    updates.push('warning_threshold = ?')
    values.push(warning_threshold)
    db.prepare(`
      INSERT INTO parameter_changes (id, scheme_id, parameter_name, old_value, new_value, changed_by, changed_at, reason)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(uuidv4(), req.params.id, 'warning_threshold', String(scheme.warning_threshold), String(warning_threshold), changed_by || 'system', reason || null)
  }
  if (critical_threshold !== undefined && critical_threshold !== scheme.critical_threshold) {
    updates.push('critical_threshold = ?')
    values.push(critical_threshold)
    db.prepare(`
      INSERT INTO parameter_changes (id, scheme_id, parameter_name, old_value, new_value, changed_by, changed_at, reason)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(uuidv4(), req.params.id, 'critical_threshold', String(scheme.critical_threshold), String(critical_threshold), changed_by || 'system', reason || null)
  }
  if (coordinate_system !== undefined) {
    updates.push('coordinate_system = ?')
    values.push(coordinate_system)
  }
  if (temperature_unit !== undefined) {
    updates.push('temperature_unit = ?')
    values.push(temperature_unit)
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare(`UPDATE schemes SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  const updatedScheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(req.params.id) as any

  if (updatedScheme.warning_threshold !== scheme.warning_threshold || updatedScheme.critical_threshold !== scheme.critical_threshold) {
    const records = db.prepare('SELECT id, temperature FROM hot_spot_records WHERE scheme_id = ?').all(req.params.id) as any[]
    const updateSeverity = db.prepare('UPDATE hot_spot_records SET severity = ?, updated_at = datetime(\'now\') WHERE id = ?')
    const updateStmt = db.transaction((rows: any[]) => {
      for (const row of rows) {
        let severity: string
        if (row.temperature >= updatedScheme.critical_threshold) {
          severity = 'critical'
        } else if (row.temperature >= updatedScheme.warning_threshold) {
          severity = 'warning'
        } else {
          severity = 'normal'
        }
        updateSeverity.run(severity, row.id)
      }
    })
    updateStmt(records)
  }

  res.json({ success: true, data: updatedScheme })
})

router.get('/:id/dashboard', (req: Request, res: Response) => {
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(req.params.id)
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }

  const totalRecords = db.prepare('SELECT COUNT(*) as count FROM hot_spot_records WHERE scheme_id = ?').get(req.params.id) as any
  const severityStats = db.prepare(`
    SELECT severity, COUNT(*) as count FROM hot_spot_records WHERE scheme_id = ? GROUP BY severity
  `).all(req.params.id) as any[]
  const statusStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM hot_spot_records WHERE scheme_id = ? GROUP BY status
  `).all(req.params.id) as any[]
  const conflictCount = db.prepare(`
    SELECT COUNT(*) as count FROM source_conflicts
    WHERE record_id IN (SELECT id FROM hot_spot_records WHERE scheme_id = ?)
  `).get(req.params.id) as any

  const resolvedConflictCount = db.prepare(`
    SELECT COUNT(*) as count FROM source_conflicts
    WHERE record_id IN (SELECT id FROM hot_spot_records WHERE scheme_id = ?)
      AND resolved_at IS NOT NULL
  `).get(req.params.id) as any

  const pendingErrors = db.prepare(`
    SELECT COUNT(*) as count FROM import_error_logs
    WHERE scheme_id = ? AND status = 'pending'
  `).get(req.params.id) as any

  const recentChanges = db.prepare(`
    SELECT COUNT(*) as count FROM parameter_changes
    WHERE scheme_id = ? AND changed_at >= datetime('now', '-7 days')
  `).get(req.params.id) as any

  const abnormalCount = (severityStats.find((s: any) => s.severity === 'warning')?.count || 0)
    + (severityStats.find((s: any) => s.severity === 'critical')?.count || 0)

  const severityMap: Record<string, number> = { normal: 0, warning: 0, critical: 0 }
  for (const s of severityStats) {
    severityMap[s.severity] = s.count
  }

  const statusMap: Record<string, number> = { active: 0, resolved: 0, conflict: 0 }
  for (const s of statusStats) {
    statusMap[s.status] = s.count
  }

  res.json({
    success: true,
    data: {
      scheme,
      totalRecords: totalRecords.count,
      abnormalCount,
      conflictCount: conflictCount.count,
      resolvedConflictCount: resolvedConflictCount.count,
      pendingErrors: pendingErrors.count,
      recentChanges: recentChanges.count,
      severityStats: severityMap,
      statusStats: statusMap,
    }
  })
})

router.get('/:schemeId/errors', (req: Request, res: Response) => {
  const { schemeId } = req.params
  const { status, sourceType } = req.query
  let sql = 'SELECT * FROM import_error_logs WHERE scheme_id = ?'
  const params: any[] = [schemeId]
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (sourceType) { sql += ' AND source_type = ?'; params.push(sourceType) }
  sql += ' ORDER BY created_at DESC'
  const errors = db.prepare(sql).all(...params)
  res.json({ success: true, data: errors })
})

router.put('/errors/:errorId', (req: Request, res: Response) => {
  const { errorId } = req.params
  const { status, resolution, resolvedBy } = req.body
  const err = db.prepare('SELECT * FROM import_error_logs WHERE id = ?').get(errorId)
  if (!err) { res.status(404).json({ success: false, error: '错误日志不存在' }); return }
  db.prepare(`
    UPDATE import_error_logs 
    SET status = ?, resolution = ?, resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(status, resolution, resolvedBy, errorId)
  const updated = db.prepare('SELECT * FROM import_error_logs WHERE id = ?').get(errorId)
  res.json({ success: true, data: updated })
})

export default router
