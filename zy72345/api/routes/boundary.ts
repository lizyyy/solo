import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { status } = req.query

    let query = `
      SELECT bs.*, sr.original_value, sr.is_negative, sr.old_table_status, sr.remark, sr.boundary_status as record_boundary_status,
             sl.name as list_name, sr.batch_id,
             (SELECT COUNT(*) FROM review_comments rc WHERE rc.boundary_id = bs.id) as review_comments_count
      FROM boundary_samples bs
      JOIN sampling_records sr ON bs.record_id = sr.id
      JOIN sampling_lists sl ON sr.list_id = sl.id
    `
    const params: string[] = []

    if (status) {
      query += ' WHERE bs.status = ?'
      params.push(status as string)
    }

    query += ' ORDER BY bs.detected_at DESC'

    const samples = db.prepare(query).all(...params)

    res.json({ success: true, data: samples })
  } catch (error) {
    console.error('查询边界样本失败:', error)
    res.status(500).json({ success: false, error: '查询边界样本失败' })
  }
})

router.put('/:id/status', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { status, confirmedBy, operatorRole, processReason, decisionDetail, correctedValue } = req.body

    if (!['confirmed', 'ignored'].includes(status)) {
      res.status(400).json({ success: false, error: '状态值无效，只支持 confirmed 或 ignored' })
      return
    }

    if (status === 'confirmed' && operatorRole !== '教研负责人') {
      res.status(403).json({ success: false, error: '只有教研负责人可以确认边界样本' })
      return
    }

    const sample = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(id) as Record<string, any> | undefined
    if (!sample) {
      res.status(404).json({ success: false, error: '边界样本不存在' })
      return
    }

    const operator = confirmedBy || 'system'
    const role = operatorRole || 'system'
    const reason = processReason || ''
    const detail = decisionDetail || ''
    const hasCorrected = correctedValue !== undefined && correctedValue !== null && correctedValue !== ''
    const correctedVal = hasCorrected ? parseFloat(correctedValue) : null

    if (status === 'confirmed' && !reason) {
      res.status(400).json({ success: false, error: '请填写处理原因' })
      return
    }

    const transaction = db.transaction(() => {
      db.prepare(
        "UPDATE boundary_samples SET status = ?, confirmed_by = ?, confirmed_at = datetime('now'), process_reason = ?, decision_detail = ?, corrected_value = ? WHERE id = ?"
      ).run(status, operator, reason, detail, correctedVal, id)

      if (status === 'confirmed') {
        db.prepare('UPDATE sampling_records SET boundary_status = ? WHERE id = ?').run('confirmed', sample.record_id)
      } else if (status === 'ignored') {
        db.prepare('UPDATE sampling_records SET boundary_status = ? WHERE id = ?').run('ignored', sample.record_id)
      }

      if (hasCorrected && !isNaN(correctedVal!)) {
        const record = db.prepare('SELECT original_value FROM sampling_records WHERE id = ?').get(sample.record_id) as { original_value: number } | undefined
        const oldVal = record ? String(record.original_value) : String(sample.original_value)
        const newVal = String(correctedVal)

        db.prepare('UPDATE sampling_records SET original_value = ? WHERE id = ?').run(correctedVal, sample.record_id)

        db.prepare(
          'INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(uuidv4(), 'sampling_record', sample.record_id, 'correct_value', 'original_value', oldVal, newVal, operator, role)
      }

      db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        uuidv4(), 'boundary_sample', id, 'update_status', 'status', sample.status, status, operator, role
      )
    })

    transaction()

    const updated = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('更新边界样本状态失败:', error)
    res.status(500).json({ success: false, error: '更新边界样本状态失败' })
  }
})

router.post('/:id/review', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { content, author, authorRole } = req.body

    if (!content || !author || !authorRole) {
      res.status(400).json({ success: false, error: '请填写完整的审核意见' })
      return
    }

    if (!['教研负责人', '学生助教'].includes(authorRole)) {
      res.status(403).json({ success: false, error: '只有教研负责人或学生助教可以添加审核意见' })
      return
    }

    const sample = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(id) as Record<string, any> | undefined
    if (!sample) {
      res.status(404).json({ success: false, error: '边界样本不存在' })
      return
    }

    const reviewId = uuidv4()
    db.prepare('INSERT INTO review_comments (id, boundary_id, author, author_role, content) VALUES (?, ?, ?, ?, ?)').run(reviewId, id, author, authorRole, content)

    db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(), 'boundary_sample', id, 'add_review', 'content', '', content, author, authorRole
    )

    const review = db.prepare('SELECT * FROM review_comments WHERE id = ?').get(reviewId)
    res.json({ success: true, data: review })
  } catch (error) {
    console.error('添加审核意见失败:', error)
    res.status(500).json({ success: false, error: '添加审核意见失败' })
  }
})

router.get('/export', (req: Request, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT sr.id as traceable_id,
             bs.original_value, bs.corrected_value,
             sr.is_negative, sr.old_table_status,
             bs.type, bs.status, bs.process_reason, bs.decision_detail,
             bs.confirmed_by, bs.confirmed_at, bs.detected_at,
             sl.name as list_name, sr.batch_id,
             (SELECT COUNT(*) FROM review_comments rc WHERE rc.boundary_id = bs.id) as review_comments_count
      FROM boundary_samples bs
      JOIN sampling_records sr ON bs.record_id = sr.id
      JOIN sampling_lists sl ON sr.list_id = sl.id
      ORDER BY bs.detected_at DESC
    `).all() as any[]

    const headers = ['traceable_id', 'original_value', 'corrected_value', 'is_negative', 'old_table_status', 'type', 'status', 'process_reason', 'decision_detail', 'confirmed_by', 'confirmed_at', 'detected_at', 'list_name', 'batch_id', 'review_comments_count']

    const csvLines = [headers.join(',')]
    for (const row of rows) {
      const line = headers.map(h => {
        const val = row[h] ?? ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"'
        }
        return str
      }).join(',')
      csvLines.push(line)
    }

    const csvContent = '\ufeff' + csvLines.join('\r\n')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `边界样本报告_${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    res.send(csvContent)
  } catch (error) {
    console.error('导出失败:', error)
    res.status(500).json({ success: false, error: '导出失败' })
  }
})

export default router
