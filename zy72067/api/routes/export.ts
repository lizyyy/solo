import { Router, type Request, type Response } from 'express'
import db from '../database.js'

const router = Router({ mergeParams: true })

router.post('/', (req: Request, res: Response) => {
  const { schemeId } = req.params
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(schemeId) as any
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }

  const records = db.prepare('SELECT * FROM hot_spot_records WHERE scheme_id = ? ORDER BY severity DESC').all(schemeId) as any[]

  const recordsWithSources = records.map(record => {
    const sources = db.prepare('SELECT * FROM source_attachments WHERE record_id = ? ORDER BY imported_at ASC').all(record.id)
    const conflicts = db.prepare('SELECT * FROM source_conflicts WHERE record_id = ?').all(record.id)
    return {
      ...record,
      sources,
      conflicts,
    }
  })

  const changes = db.prepare('SELECT * FROM parameter_changes WHERE scheme_id = ? ORDER BY changed_at ASC').all(schemeId)
  const allConflicts = db.prepare(`
    SELECT sc.* FROM source_conflicts sc
    INNER JOIN hot_spot_records hsr ON sc.record_id = hsr.id
    WHERE hsr.scheme_id = ?
    ORDER BY sc.severity DESC
  `).all(schemeId)

  const coordinateSystems = [...new Set(records.map(r => r.coordinate_system))]

  const report = {
    export_time: new Date().toISOString(),
    scheme: {
      id: scheme.id,
      name: scheme.name,
      description: scheme.description,
      warning_threshold: scheme.warning_threshold,
      critical_threshold: scheme.critical_threshold,
      coordinate_system: scheme.coordinate_system,
      temperature_unit: scheme.temperature_unit,
    },
    summary: {
      total_records: records.length,
      severity_distribution: {
        critical: records.filter(r => r.severity === 'critical').length,
        warning: records.filter(r => r.severity === 'warning').length,
        normal: records.filter(r => r.severity === 'normal').length,
      },
      total_conflicts: allConflicts.length,
      unresolved_conflicts: allConflicts.filter((c: any) => !c.resolved_at).length,
      coordinate_systems: coordinateSystems,
    },
    records: recordsWithSources,
    parameter_changes: changes,
    conflicts: allConflicts,
    coordinate_system_annotations: coordinateSystems.map(cs => ({
      system: cs,
      record_count: records.filter(r => r.coordinate_system === cs).length,
    })),
  }

  res.json({ success: true, data: report })
})

export default router
