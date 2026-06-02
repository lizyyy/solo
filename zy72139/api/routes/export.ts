import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { status, source, keyword } = req.query

  let sql = 'SELECT * FROM schedule WHERE 1=1'
  const params: unknown[] = []

  if (status && typeof status === 'string') {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (source && typeof source === 'string') {
    sql += ' AND source = ?'
    params.push(source)
  }
  if (keyword && typeof keyword === 'string') {
    sql += ' AND (part_no LIKE ? OR track_name LIKE ? OR file_name LIKE ? OR remark LIKE ?)'
    const like = `%${keyword}%`
    params.push(like, like, like, like)
  }

  sql += ' ORDER BY id ASC'
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]

  const statusLabels: Record<string, string> = {
    pending: '待排程',
    scheduled: '已排程',
    missing_auth: '缺授权',
    version_conflict: '版本冲突',
    duplicate: '重复项',
  }

  const header = '备件编号,曲目名称,文件名,来源,版本,排程状态,备注,原始来源,处理时间,最后修改人,最后修改时间\n'
  const csvRows = rows.map(r =>
    [
      csvEscape(String(r.part_no || '')),
      csvEscape(String(r.track_name || '')),
      csvEscape(String(r.file_name || '')),
      csvEscape(String(r.source || '')),
      String(r.version || 1),
      csvEscape(statusLabels[String(r.status)] || String(r.status)),
      csvEscape(String(r.remark || '')),
      csvEscape(String(r.original_source || '')),
      csvEscape(String(r.processed_at || '')),
      csvEscape(String(r.modified_by || '')),
      csvEscape(String(r.modified_at || '')),
    ].join(',')
  ).join('\n')

  const bom = '\uFEFF'
  const csv = bom + header + csvRows

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename=schedule_export_${Date.now()}.csv`)
  res.send(csv)
})

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

export default router
