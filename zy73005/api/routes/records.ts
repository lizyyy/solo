import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface RecordListItem {
  id: number
  dogId: number
  dogName: string
  aliasNames: string
  vaccineName: string
  inoculationDate: string
  status: string
  source: string
  hasAliasConflict: number
  currentConclusion: string
}

interface RecordDetail {
  id: number
  dogId: number
  dogName: string
  breed: string
  ownerName: string
  ownerContact: string
  vaccineName: string
  batchNo: string
  inoculationDate: string
  validUntil: string
  institution: string
  status: string
  source: string
  currentConclusion: string
  aliasNames: { id: number; aliasName: string; isConflict: number }[]
  aliasConflictDetail: {
    hasConflict: boolean
    conflicts: { aliasName: string; conflictingDog: { id: number; name: string; breed: string; ownerName: string } }[]
  }
  weightHistory: { id: number; date: string; weight: number | null; isEstimated: number }[]
  remarks: { id: number; content: string; type: string; createdAt: string }[]
}

interface HistoryItem {
  id: number
  recordId: number
  type: string
  field: string
  oldValue: string | null
  newValue: string
  reason: string | null
  createdAt: string
}

router.get('/', (req: Request, res: Response): void => {
  const { status, keyword } = req.query

  let sql = `
    SELECT vr.id, vr.dog_id as dogId, d.name as dogName,
      GROUP_CONCAT(da.alias_name) as aliasNames,
      vr.vaccine_name as vaccineName, vr.inoculation_date as inoculationDate,
      vr.status, vr.source, vr.current_conclusion as currentConclusion,
      MAX(COALESCE(da.is_conflict, 0)) as hasAliasConflict
    FROM vaccine_record vr
    JOIN dog d ON vr.dog_id = d.id
    LEFT JOIN dog_alias da ON d.id = da.dog_id
    WHERE 1=1
  `
  const params: (string | number)[] = []

  if (status) {
    sql += ' AND vr.status = ?'
    params.push(status as string)
  }

  if (keyword) {
    sql += ` AND (d.name LIKE ? OR d.owner_name LIKE ? OR vr.vaccine_name LIKE ? OR vr.institution LIKE ? OR vr.batch_no LIKE ?)`
    const like = `%${keyword}%`
    params.push(like, like, like, like, like)
  }

  sql += ' GROUP BY vr.id ORDER BY vr.inoculation_date DESC'

  const records = db.prepare(sql).all(...params) as RecordListItem[]

  res.json({ success: true, data: records })
})

router.get('/:id', (req: Request, res: Response): void => {
  const id = Number(req.params.id)

  const record = db.prepare(`
    SELECT vr.*, d.name as dogName, d.breed, d.owner_name as ownerName, d.owner_contact as ownerContact
    FROM vaccine_record vr
    JOIN dog d ON vr.dog_id = d.id
    WHERE vr.id = ?
  `).get(id) as RecordDetail | undefined

  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const aliases = db.prepare(
    'SELECT id, alias_name as aliasName, is_conflict as isConflict FROM dog_alias WHERE dog_id = ?'
  ).all(record.dogId) as { id: number; aliasName: string; isConflict: number }[]

  const conflicts: { aliasName: string; conflictingDog: { id: number; name: string; breed: string; ownerName: string } }[] = []
  for (const alias of aliases) {
    if (alias.isConflict === 1) {
      const conflictingDog = db.prepare(
        'SELECT id, name, breed, owner_name as ownerName FROM dog WHERE name = ? AND id != ?'
      ).get(alias.aliasName, record.dogId) as { id: number; name: string; breed: string; ownerName: string } | undefined
      if (conflictingDog) {
        conflicts.push({ aliasName: alias.aliasName, conflictingDog })
      }
    }
  }

  const weightHistory = db.prepare(
    'SELECT id, date, weight, is_estimated as isEstimated FROM weight_log WHERE dog_id = ? ORDER BY date'
  ).all(record.dogId) as { id: number; date: string; weight: number | null; isEstimated: number }[]

  const remarks = db.prepare(
    'SELECT id, content, type, created_at as createdAt FROM record_remark WHERE record_id = ? ORDER BY created_at'
  ).all(id) as { id: number; content: string; type: string; createdAt: string }[]

  const result: RecordDetail = {
    id: record.id,
    dogId: record.dogId,
    dogName: record.dogName,
    breed: record.breed,
    ownerName: record.ownerName,
    ownerContact: record.ownerContact,
    vaccineName: record.vaccineName,
    batchNo: record.batchNo,
    inoculationDate: record.inoculationDate,
    validUntil: record.validUntil,
    institution: record.institution,
    status: record.status,
    source: record.source,
    currentConclusion: record.currentConclusion,
    aliasNames: aliases,
    aliasConflictDetail: {
      hasConflict: conflicts.length > 0,
      conflicts
    },
    weightHistory,
    remarks
  }

  res.json({ success: true, data: result })
})

router.post('/:id/rejudge', (req: Request, res: Response): void => {
  const id = Number(req.params.id)
  const { newConclusion, reason } = req.body

  if (!newConclusion || !reason) {
    res.status(400).json({ success: false, error: '缺少 newConclusion 或 reason' })
    return
  }

  const record = db.prepare(
    'SELECT * FROM vaccine_record WHERE id = ?'
  ).get(id) as { id: number; status: string; source: string; current_conclusion: string } | undefined

  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const transaction = db.transaction(() => {
    db.prepare(
      "UPDATE vaccine_record SET status = 'rejudged', source = 'rejudged', current_conclusion = ? WHERE id = ?"
    ).run(newConclusion, id)

    db.prepare(
      'INSERT INTO record_history (record_id, type, field, old_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, 'rejudged', 'conclusion', record.current_conclusion, newConclusion, reason)

    db.prepare(
      'INSERT INTO record_history (record_id, type, field, old_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, 'rejudged', 'status', record.status, 'rejudged', reason)

    db.prepare(
      'INSERT INTO record_remark (record_id, content, type) VALUES (?, ?, ?)'
    ).run(id, `改判结论：${newConclusion}，原因：${reason}`, 'rejudged')
  })

  transaction()

  res.json({ success: true, data: { id, status: 'rejudged', source: 'rejudged', currentConclusion: newConclusion } })
})

router.post('/:id/remarks', (req: Request, res: Response): void => {
  const id = Number(req.params.id)
  const { content } = req.body

  if (!content) {
    res.status(400).json({ success: false, error: '缺少 content' })
    return
  }

  const record = db.prepare('SELECT id FROM vaccine_record WHERE id = ?').get(id)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const result = db.prepare(
    "INSERT INTO record_remark (record_id, content, type) VALUES (?, ?, 'supplementary')"
  ).run(id, content)

  res.json({ success: true, data: { id: result.lastInsertRowid, recordId: id, content, type: 'supplementary' } })
})

router.get('/:id/history', (req: Request, res: Response): void => {
  const id = Number(req.params.id)

  const record = db.prepare('SELECT id FROM vaccine_record WHERE id = ?').get(id)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const history = db.prepare(
    'SELECT id, record_id as recordId, type, field, old_value as oldValue, new_value as newValue, reason, created_at as createdAt FROM record_history WHERE record_id = ? ORDER BY created_at'
  ).all(id) as HistoryItem[]

  res.json({ success: true, data: history })
})

export function generateReport(): { markdown: string; summary: { total: number; pending: number; reviewed: number; supplementary: number; rejudged: number; original: number } } {
  const records = db.prepare(`
    SELECT vr.id, vr.vaccine_name, vr.batch_no, vr.inoculation_date, vr.valid_until,
      vr.institution, vr.status, vr.source, vr.current_conclusion,
      d.name as dogName, d.breed, d.owner_name
    FROM vaccine_record vr
    JOIN dog d ON vr.dog_id = d.id
    ORDER BY vr.inoculation_date
  `).all() as {
    id: number; vaccine_name: string; batch_no: string; inoculation_date: string;
    valid_until: string; institution: string; status: string; source: string;
    current_conclusion: string; dogName: string; breed: string; owner_name: string
  }[]

  const summary = {
    total: records.length,
    pending: records.filter(r => r.status === 'pending').length,
    reviewed: records.filter(r => r.status === 'reviewed').length,
    supplementary: records.filter(r => r.source === 'supplementary').length,
    rejudged: records.filter(r => r.status === 'rejudged').length,
    original: records.filter(r => r.source === 'original').length,
  }

  let markdown = '# 犬只疫苗记录复核报告\n\n'

  for (const r of records) {
    let badge = ''
    if (r.source === 'supplementary') badge += ' ⚠️ 补录'
    if (r.status === 'rejudged') badge += ' 🔄 改判'

    markdown += `## ${r.dogName}（${r.breed}）${badge}\n`
    markdown += `- 犬主：${r.owner_name}\n`
    markdown += `- 疫苗：${r.vaccine_name}\n`
    markdown += `- 批号：${r.batch_no}\n`
    markdown += `- 接种日期：${r.inoculation_date}\n`
    markdown += `- 有效期至：${r.valid_until}\n`
    markdown += `- 接种机构：${r.institution}\n`
    markdown += `- 状态：${r.status}\n`
    markdown += `- 来源：${r.source}\n`
    markdown += `- 结论：${r.current_conclusion}\n\n`
  }

  markdown += '---\n\n'
  markdown += '## 汇总\n\n'
  markdown += `- 总记录数：${summary.total}\n`
  markdown += `- 待复核：${summary.pending}\n`
  markdown += `- 已复核：${summary.reviewed}\n`
  markdown += `- 已改判：${summary.rejudged}\n`
  markdown += `- 原始记录：${summary.original}\n`
  markdown += `- 补录记录：${summary.supplementary}\n`

  return { markdown, summary }
}

export default router
