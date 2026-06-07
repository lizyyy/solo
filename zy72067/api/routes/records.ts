import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router({ mergeParams: true })

router.get('/', (req: Request, res: Response) => {
  const { schemeId } = req.params
  const { severity, status, coordinateSystem } = req.query

  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(schemeId)
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }

  let sql = 'SELECT * FROM hot_spot_records WHERE scheme_id = ?'
  const params: any[] = [schemeId]

  if (severity) {
    sql += ' AND severity = ?'
    params.push(severity)
  }
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (coordinateSystem) {
    sql += ' AND coordinate_system = ?'
    params.push(coordinateSystem)
  }

  sql += ' ORDER BY updated_at DESC'
  const records = db.prepare(sql).all(...params)
  res.json({ success: true, data: records })
})

router.post('/', (req: Request, res: Response) => {
  const { schemeId } = req.params
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(schemeId) as any
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }

  const { name, coordinate_x, coordinate_y, coordinate_system, temperature, status } = req.body
  if (!name || coordinate_x === undefined || coordinate_y === undefined || !coordinate_system || temperature === undefined) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  let severity: string
  if (temperature >= scheme.critical_threshold) {
    severity = 'critical'
  } else if (temperature >= scheme.warning_threshold) {
    severity = 'warning'
  } else {
    severity = 'normal'
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO hot_spot_records (id, scheme_id, name, coordinate_x, coordinate_y, coordinate_system, temperature, severity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, schemeId, name, coordinate_x, coordinate_y, coordinate_system, temperature, severity, status || 'active')

  const record = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: record })
})

router.get('/:id', (req: Request, res: Response) => {
  const record = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(req.params.id)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, data: record })
})

router.put('/:id', (req: Request, res: Response) => {
  const record = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(req.params.id) as any
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const { name, coordinate_x, coordinate_y, coordinate_system, temperature, status } = req.body
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(record.scheme_id) as any

  const updates: string[] = []
  const values: any[] = []

  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  if (coordinate_x !== undefined) { updates.push('coordinate_x = ?'); values.push(coordinate_x) }
  if (coordinate_y !== undefined) { updates.push('coordinate_y = ?'); values.push(coordinate_y) }
  if (coordinate_system !== undefined) { updates.push('coordinate_system = ?'); values.push(coordinate_system) }
  if (temperature !== undefined) {
    updates.push('temperature = ?')
    values.push(temperature)
    if (scheme) {
      let severity: string
      if (temperature >= scheme.critical_threshold) {
        severity = 'critical'
      } else if (temperature >= scheme.warning_threshold) {
        severity = 'warning'
      } else {
        severity = 'normal'
      }
      updates.push('severity = ?')
      values.push(severity)
    }
  }
  if (status !== undefined) { updates.push('status = ?'); values.push(status) }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare(`UPDATE hot_spot_records SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  const updated = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

router.get('/:recordId/snapshots', (req: Request, res: Response) => {
  const { recordId } = req.params
  const snapshots = db.prepare('SELECT * FROM correction_snapshots WHERE record_id = ? ORDER BY corrected_at DESC').all(recordId)
  res.json({ success: true, data: snapshots })
})

router.post('/:recordId/snapshots', (req: Request, res: Response) => {
  const { recordId } = req.params
  const { fieldName, oldValue, newValue, reason, correctedBy, snapshotData } = req.body
  const record = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(recordId) as any
  if (!record) { res.status(404).json({ success: false, error: '记录不存在' }); return }
  const id = 'snap-' + Date.now()
  db.prepare(`
    INSERT INTO correction_snapshots (id, record_id, field_name, old_value, new_value, reason, corrected_by, snapshot_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, recordId, fieldName, String(oldValue), String(newValue), reason, correctedBy, JSON.stringify(snapshotData || {}))
  const upd: any = {}
  if (fieldName === 'temperature') {
    upd.temperature = parseFloat(newValue)
  } else if (fieldName === 'name') {
    upd.name = newValue
  } else if (fieldName === 'coordinateX') {
    upd.coordinate_x = parseFloat(newValue)
  } else if (fieldName === 'coordinateY') {
    upd.coordinate_y = parseFloat(newValue)
  }
  if (Object.keys(upd).length > 0) {
    const setClauses = Object.keys(upd).map(k => `${k} = ?`).join(', ')
    const setParams = [...Object.values(upd), recordId]
    if (fieldName === 'temperature') {
      const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(record.scheme_id) as any
      let severity = 'normal'
      if (upd.temperature >= scheme.critical_threshold) severity = 'critical'
      else if (upd.temperature >= scheme.warning_threshold) severity = 'warning'
      db.prepare(`UPDATE hot_spot_records SET ${setClauses}, severity = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(...Object.values(upd), severity, recordId)
    } else {
      db.prepare(`UPDATE hot_spot_records SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...setParams)
    }
  }
  const snapshot = db.prepare('SELECT * FROM correction_snapshots WHERE id = ?').get(id)
  res.json({ success: true, data: snapshot })
})

export default router
