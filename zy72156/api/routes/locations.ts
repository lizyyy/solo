import express, { type Request, type Response } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
const db = getDb()

function parseJsonSafe(str: string | null): any {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

function serializeRow(row: any): any {
  return {
    ...row,
    aliases: parseJsonSafe(row.aliases),
    has_coordinate_drift: row.has_coordinate_drift === 1
  }
}

router.get('/', (req: Request, res: Response) => {
  const { search, has_drift } = req.query

  let sql = 'SELECT * FROM locations WHERE 1=1'
  const params: any[] = []

  if (search) {
    sql += ' AND (canonical_name LIKE ? OR aliases LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  if (has_drift === 'true') {
    sql += ' AND has_coordinate_drift = 1'
  } else if (has_drift === 'false') {
    sql += ' AND has_coordinate_drift = 0'
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as any[]
  res.json({ success: true, data: rows.map(serializeRow) })
})

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as any
  if (!location) {
    return res.status(404).json({ success: false, error: '点位不存在' })
  }

  const feedback = db.prepare('SELECT * FROM feedback WHERE location_id = ? ORDER BY reported_at DESC').all(id) as any[]
  const schemes = db.prepare('SELECT * FROM schemes WHERE location_id = ? ORDER BY version DESC').all(id) as any[]
  const reports = db.prepare('SELECT * FROM reports WHERE location_id = ? ORDER BY generated_at DESC').all(id) as any[]
  const notes = db.prepare('SELECT * FROM manual_notes WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC').all('location', id) as any[]

  res.json({
    success: true,
    data: {
      ...serializeRow(location),
      feedback: feedback.map(f => ({
        ...f,
        is_duplicate: f.is_duplicate === 1,
        is_boundary: f.is_boundary === 1
      })),
      schemes: schemes.map(s => ({
        ...s,
        source_refs: parseJsonSafe(s.source_refs)
      })),
      reports: reports.map(r => ({
        ...r,
        cross_period_stats: parseJsonSafe(r.cross_period_stats),
        source_trace: parseJsonSafe(r.source_trace)
      })),
      notes
    }
  })
})

router.post('/', (req: Request, res: Response) => {
  const { canonical_name, aliases = [], lat, lng, has_coordinate_drift = false, drift_note = null } = req.body

  if (!canonical_name || lat == null || lng == null) {
    return res.status(400).json({ success: false, error: '点位名称和坐标必填' })
  }

  const id = `loc-${uuidv4().slice(0, 8)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare(`
    INSERT INTO locations (id, canonical_name, aliases, lat, lng, has_coordinate_drift, drift_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, canonical_name, JSON.stringify(aliases), lat, lng, has_coordinate_drift ? 1 : 0, drift_note, now, now)

  const created = db.prepare('SELECT * FROM locations WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(created) })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { canonical_name, aliases, lat, lng, has_coordinate_drift, drift_note } = req.body

  const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ success: false, error: '点位不存在' })
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare(`
    UPDATE locations
    SET canonical_name = COALESCE(?, canonical_name),
        aliases = COALESCE(?, aliases),
        lat = COALESCE(?, lat),
        lng = COALESCE(?, lng),
        has_coordinate_drift = COALESCE(?, has_coordinate_drift),
        drift_note = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    canonical_name,
    aliases ? JSON.stringify(aliases) : null,
    lat,
    lng,
    has_coordinate_drift != null ? (has_coordinate_drift ? 1 : 0) : null,
    drift_note,
    now,
    id
  )

  const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(updated) })
})

router.post('/:id/merge', (req: Request, res: Response) => {
  const { id } = req.params
  const { merge_ids } = req.body as { merge_ids: string[] }

  if (!Array.isArray(merge_ids) || merge_ids.length === 0) {
    return res.status(400).json({ success: false, error: '请提供要合并的点位ID列表' })
  }

  const target = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as any
  if (!target) {
    return res.status(404).json({ success: false, error: '目标点位不存在' })
  }

  const allAliases: string[] = [...parseJsonSafe(target.aliases)]

  for (const mid of merge_ids) {
    const source = db.prepare('SELECT * FROM locations WHERE id = ?').get(mid) as any
    if (!source) continue

    allAliases.push(source.canonical_name)
    allAliases.push(...parseJsonSafe(source.aliases))

    db.prepare('UPDATE feedback SET location_id = ? WHERE location_id = ?').run(id, mid)
    db.prepare('UPDATE schemes SET location_id = ? WHERE location_id = ?').run(id, mid)
    db.prepare('UPDATE reports SET location_id = ? WHERE location_id = ?').run(id, mid)
    db.prepare('DELETE FROM manual_notes WHERE target_type = ? AND target_id = ?').run('location', mid)
    db.prepare('DELETE FROM locations WHERE id = ?').run(mid)
  }

  const uniqueAliases = [...new Set(allAliases)]
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare('UPDATE locations SET aliases = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(uniqueAliases), now, id
  )

  const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(updated) })
})

export default router
