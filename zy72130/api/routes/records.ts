import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

const router = Router()

interface RecordRow {
  id: string
  track_name: string
  artist: string
  revenue: number
  share_ratio: number | null
  share_amount: number | null
  status: string
  source: string
  original_note: string
  current_note: string
  attachments: string
  created_at: string
  updated_at: string
}

function rowToApi(row: RecordRow) {
  return {
    id: row.id,
    trackName: row.track_name,
    artist: row.artist,
    revenue: row.revenue,
    shareRatio: row.share_ratio,
    shareAmount: row.share_amount,
    status: row.status,
    source: row.source,
    originalNote: row.original_note,
    currentNote: row.current_note,
    attachments: JSON.parse(row.attachments || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { status, source, dateFrom, dateTo, sortBy, sortOrder } = req.query

  let sql = 'SELECT * FROM records WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (source) {
    sql += ' AND source = ?'
    params.push(source)
  }
  if (dateFrom) {
    sql += ' AND date(created_at) >= date(?)'
    params.push(dateFrom)
  }
  if (dateTo) {
    sql += ' AND date(created_at) <= date(?)'
    params.push(dateTo)
  }

  const sortFieldMap: Record<string, string> = {
    createdAt: 'created_at',
    revenue: 'revenue',
    trackName: 'track_name',
  }
  const field = sortFieldMap[String(sortBy)] || 'created_at'
  const order = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  sql += ` ORDER BY ${field} ${order}`

  const rows = db.prepare(sql).all(...params) as RecordRow[]
  res.json({ records: rows.map(rowToApi) })
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params.id) as RecordRow | undefined

  if (!row) {
    res.status(404).json({ error: '记录不存在' })
    return
  }

  res.json({ record: rowToApi(row) })
})

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { id } = req.params
  const { currentNote, status, shareRatio, shareAmount, manualOverrideReason } = req.body

  const existing = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as RecordRow | undefined
  if (!existing) {
    res.status(404).json({ error: '记录不存在' })
    return
  }

  const updates: string[] = []
  const params: unknown[] = []

  if (currentNote !== undefined) {
    updates.push('current_note = ?')
    params.push(currentNote)

    if (currentNote !== existing.current_note) {
      const maxStep = db.prepare('SELECT MAX(step) as max_step FROM judgment_logs WHERE record_id = ?').get(id) as { max_step: number | null }
      const nextStep = (maxStep?.max_step || 0) + 1
      db.prepare(
        'INSERT INTO judgment_logs (id, record_id, step, type, description, result) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), id, nextStep, 'note_added', '补录备注', `备注从"${existing.current_note}"变更为"${currentNote}"`)
    }
  }

  if (status !== undefined) {
    updates.push('status = ?')
    params.push(status)

    if (status !== existing.status && manualOverrideReason) {
      const maxStep = db.prepare('SELECT MAX(step) as max_step FROM judgment_logs WHERE record_id = ?').get(id) as { max_step: number | null }
      const nextStep = (maxStep?.max_step || 0) + 1
      db.prepare(
        'INSERT INTO judgment_logs (id, record_id, step, type, description, result) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), id, nextStep, 'manual_override', `人工标注：${manualOverrideReason}`, `状态从"${existing.status}"变更为"${status}"`)
    }
  }

  if (shareRatio !== undefined) {
    updates.push('share_ratio = ?')
    params.push(shareRatio)

    if (shareRatio !== existing.share_ratio) {
      const maxStep = db.prepare('SELECT MAX(step) as max_step FROM judgment_logs WHERE record_id = ?').get(id) as { max_step: number | null }
      const nextStep = (maxStep?.max_step || 0) + 1
      db.prepare(
        'INSERT INTO judgment_logs (id, record_id, step, type, description, result) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), id, nextStep, 'diff_detected', `分账比例变更`, `比例从"${existing.share_ratio}"变更为"${shareRatio}"`)
    }
  }

  if (shareAmount !== undefined) {
    updates.push('share_amount = ?')
    params.push(shareAmount)
  }

  if (updates.length === 0) {
    res.json({ record: rowToApi(existing) })
    return
  }

  updates.push("updated_at = datetime('now', 'localtime')")
  params.push(id)

  db.prepare(`UPDATE records SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updated = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as RecordRow
  res.json({ record: rowToApi(updated) })
})

export default router
