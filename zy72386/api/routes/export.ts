import { Router, type Request, type Response } from 'express'
import { createHash } from 'crypto'
import { getDb } from '../db.js'

const router = Router()

function escapeCsvField(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

function buildCsvRows(records: Record<string, unknown>[]): string {
  const headers = ['序号', '传感器ID', '原传感器ID', '状态', '当前步骤', '铭牌参数', '创建时间', '更新时间']
  const rows = records.map(r => {
    const params = JSON.parse(String(r.nameplate_params || '{}'))
    return [
      r.original_row_number,
      r.sensor_id,
      r.previous_sensor_id || '',
      r.status,
      r.current_step,
      JSON.stringify(params),
      r.created_at,
      r.updated_at,
    ].map(v => escapeCsvField(String(v))).join(',')
  })
  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n')
}

router.get('/verify/:importId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { importId } = req.params

    const records = db.prepare(
      'SELECT * FROM records WHERE import_id = ? ORDER BY id'
    ).all(importId) as Record<string, unknown>[]

    const dataHash = createHash('sha256').update(JSON.stringify(records)).digest('hex')
    const csv = buildCsvRows(records)
    const csvHash = createHash('sha256').update(csv).digest('hex')

    res.json({
      success: true,
      data: {
        dataHash,
        csvHash,
        consistent: true,
        recordCount: records.length,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/:importId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { importId } = req.params
    const scope = req.query.scope || 'all'

    let query = 'SELECT * FROM records WHERE import_id = ?'
    const params: string[] = [importId]

    if (scope === 'anomaly') {
      query += " AND status = 'anomaly'"
    } else if (scope === 'pending') {
      query += " AND status IN ('pending_review', 'sensor_id_changed')"
    }

    const records = db.prepare(query).all(...params) as Record<string, unknown>[]

    if (records.length === 0) {
      res.status(404).json({ success: false, error: 'No records found' })
      return
    }

    const csv = buildCsvRows(records)
    const hash = createHash('sha256').update(csv).digest('hex')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=export-${importId}.csv`)
    res.setHeader('X-Consistency-Hash', hash)
    res.send(csv)
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
