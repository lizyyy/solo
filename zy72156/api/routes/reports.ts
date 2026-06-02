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
    cross_period_stats: parseJsonSafe(row.cross_period_stats),
    source_trace: parseJsonSafe(row.source_trace)
  }
}

function generateReportContent(location: any, scheme: any, feedback: any[]): string {
  const duplicateCount = feedback.filter(f => f.is_duplicate).length
  const boundaryCount = feedback.filter(f => f.is_boundary).length
  const feedbackByMonth: Record<string, number> = {}

  for (const fb of feedback) {
    const month = fb.reported_at?.slice(0, 7) || '未知'
    feedbackByMonth[month] = (feedbackByMonth[month] || 0) + 1
  }

  const months = Object.keys(feedbackByMonth).sort()
  const periodStats = months.map(m => `${m}：${feedbackByMonth[m]}条`).join('；')

  const sourceTypes = [...new Set(feedback.map(f => f.source_type))].join('、')
  const sourceList = feedback.map(f => `  • ${f.source_type} - ${f.source}（${f.reported_at?.slice(0, 16)}）`).join('\n')

  return `【调解概况】
${location.canonical_name}公园活动噪声问题，经${sourceTypes}等${feedback.length}条反馈（其中重复${duplicateCount}条、边界记录${boundaryCount}条），我处于${scheme.created_at?.slice(0, 10)}发布${scheme.title}。

【方案内容】
${scheme.content}

【来源追踪】
${sourceList}

【跨时段统计】
${periodStats}

【特别说明】
1. 重复投诉已合并处理，不影响统计总量
2. 边界记录：${boundaryCount > 0 ? '存在边界问题，需确认管辖后再推进' : '无'}
3. 历史方案均已保留，可在方案版本中查阅
4. 所有来源均可通过对应ID追溯原始记录

老曹 记
${new Date().toISOString().slice(0, 10)}`
}

router.get('/', (req: Request, res: Response) => {
  const { location_id } = req.query

  let sql = 'SELECT * FROM reports WHERE 1=1'
  const params: any[] = []

  if (location_id) {
    sql += ' AND location_id = ?'
    params.push(location_id)
  }

  sql += ' ORDER BY generated_at DESC'

  const rows = db.prepare(sql).all(...params) as any[]
  res.json({ success: true, data: rows.map(serializeRow) })
})

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any
  if (!report) {
    return res.status(404).json({ success: false, error: '报告不存在' })
  }

  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(report.location_id)
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(report.scheme_id)

  const notes = db.prepare(`
    SELECT * FROM manual_notes
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at DESC
  `).all('report', id) as any[]

  res.json({
    success: true,
    data: {
      ...serializeRow(report),
      location,
      scheme,
      notes
    }
  })
})

router.post('/', (req: Request, res: Response) => {
  const { location_id, scheme_id, generated_by = '老曹' } = req.body

  if (!location_id || !scheme_id) {
    return res.status(400).json({ success: false, error: '点位ID和方案ID必填' })
  }

  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id) as any
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(scheme_id) as any

  if (!location || !scheme) {
    return res.status(404).json({ success: false, error: '点位或方案不存在' })
  }

  const feedback = db.prepare(`
    SELECT * FROM feedback WHERE location_id = ? ORDER BY reported_at
  `).all(location_id) as any[]

  const crossPeriodStats: Record<string, number> = {}
  for (const fb of feedback) {
    const month = fb.reported_at?.slice(0, 7) || '未知'
    crossPeriodStats[month] = (crossPeriodStats[month] || 0) + 1
  }

  const sourceTrace = feedback.map(f => ({
    ref: f.id,
    type: f.source_type,
    time: f.reported_at
  }))

  const id = `rpt-${uuidv4().slice(0, 8)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const title = `${location.canonical_name}噪声调解报告（${now.slice(0, 10)}）`
  const content = generateReportContent(location, scheme, feedback)

  db.prepare(`
    INSERT INTO reports (id, location_id, scheme_id, title, content, cross_period_stats, source_trace, generated_at, generated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    location_id,
    scheme_id,
    title,
    content,
    JSON.stringify(crossPeriodStats),
    JSON.stringify(sourceTrace),
    now,
    generated_by
  )

  const created = db.prepare('SELECT * FROM reports WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(created) })
})

export default router
