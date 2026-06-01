import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { status, source, dateFrom, dateTo } = req.query

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
    sql += ' AND created_at >= ?'
    params.push(dateFrom)
  }
  if (dateTo) {
    sql += ' AND created_at <= ?'
    params.push(dateTo)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]

  const BOM = '\uFEFF'
  const header = '曲目名,演出者,票房收入,分账比例,分账金额,状态,来源,原始备注,当前备注,创建时间'
  const statusMap: Record<string, string> = { smooth: '顺利', needs_confirmation: '待确认', old_standard: '旧口径' }
  const sourceMap: Record<string, string> = { excel: 'Excel', audio: '音频', contract: '合同', chat_annotation: '群聊批注' }

  const csvRows = rows.map(r => [
    String(r.track_name || ''),
    String(r.artist || ''),
    String(r.revenue || 0),
    r.share_ratio != null ? `${(Number(r.share_ratio) * 100).toFixed(0)}%` : '',
    r.share_amount != null ? String(r.share_amount) : '',
    statusMap[String(r.status)] || String(r.status),
    sourceMap[String(r.source)] || String(r.source),
    `"${String(r.original_note || '').replace(/"/g, '""')}"`,
    `"${String(r.current_note || '').replace(/"/g, '""')}"`,
    String(r.created_at || ''),
  ].join(','))

  const csv = BOM + header + '\n' + csvRows.join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=livehouse-revenue-export.csv')
  res.send(csv)
})

export default router
