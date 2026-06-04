import { getDb } from '../database.js'
import { v4 as uuidv4 } from 'uuid'
import { checkBoundary } from './boundaryRuleEngine.js'
import { recordChange, getHistoryForItem } from './changeTracker.js'

export interface AssessmentItem {
  id: string
  file_name: string
  file_hash: string
  line_number: number
  raw_conclusion: string
  direction: string | null
  direction_normalized: string | null
  remark: string
  status: string
  boundary_flag: number
  boundary_rule: string | null
  created_at: string
  updated_at: string
}

export interface ImportPhoto {
  fileName: string
  fileHash: string
  lineNumber: number
  rawConclusion: string
  rawDirection?: string
}

export interface ImportResult {
  imported: number
  duplicates: { fileName: string; lineNumber: number }[]
  items: AssessmentItem[]
}

export async function importPhotos(photos: ImportPhoto[], operator: string): Promise<ImportResult> {
  const db = getDb()
  const items: AssessmentItem[] = []
  const duplicates: { fileName: string; lineNumber: number }[] = []
  let imported = 0

  const insertStmt = db.prepare(`
    INSERT INTO assessment_items (id, file_name, file_hash, line_number, raw_conclusion, direction, direction_normalized, remark, status, boundary_flag, boundary_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const doImport = db.transaction(() => {
    for (const photo of photos) {
      const existing = db.prepare(
        'SELECT id FROM assessment_items WHERE file_hash = ? AND line_number = ?',
      ).get(photo.fileHash, photo.lineNumber)

      if (existing) {
        duplicates.push({ fileName: photo.fileName, lineNumber: photo.lineNumber })
        continue
      }

      const id = uuidv4()
      const direction = photo.rawDirection ?? null
      let directionNormalized: string | null = null
      let boundaryFlag = 0
      let boundaryRule: string | null = null

      if (direction) {
        const result = checkBoundarySync('direction', direction)
        if (result.matched && result.rule) {
          boundaryFlag = 1
          boundaryRule = result.rule.id
          directionNormalized = result.normalizedValue ?? null
        }
      }

      insertStmt.run(id, photo.fileName, photo.fileHash, photo.lineNumber, photo.rawConclusion, direction, directionNormalized, remark, status, boundaryFlag, boundaryRule)
      imported++

      const item = db.prepare('SELECT * FROM assessment_items WHERE id = ?').get(id) as AssessmentItem
      items.push(item)

      recordChangeSync(id, 'status', '', '待补看', operator, '工况照片首次导入')
      if (direction) {
        recordChangeSync(id, 'direction', '', direction, operator, '工况照片首次导入')
      }
      if (boundaryFlag) {
        recordChangeSync(id, 'boundary_flag', '0', '1', operator, `边界规则触发：${boundaryRule}`)
      }
    }
  })

  doImport()
  return { imported, duplicates, items }
}

function checkBoundarySync(category: string, value: string): { matched: boolean; rule?: any; normalizedValue?: string } {
  const db = getDb()
  const rules = db.prepare('SELECT * FROM boundary_rules WHERE category = ? AND active = 1').all(category) as any[]

  for (const rule of rules) {
    if (value.includes(rule.pattern)) {
      return {
        matched: true,
        rule,
        normalizedValue: rule.normalized_value,
      }
    }
  }
  return { matched: false }
}

function recordChangeSync(itemId: string, field: string, oldValue: string, newValue: string, changedBy: string, reason?: string): void {
  const db = getDb()
  const id = uuidv4()
  if (oldValue === newValue) return

  db.prepare(`
    INSERT INTO change_records (id, item_id, field, old_value, new_value, changed_by, changed_at, reason)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
  `).run(id, itemId, field, oldValue, newValue, changedBy, reason ?? null)
}

export async function listAssessments(status?: string): Promise<AssessmentItem[]> {
  const db = getDb()
  if (status && status !== '全部') {
    return db.prepare('SELECT * FROM assessment_items WHERE status = ? ORDER BY created_at DESC').all(status) as AssessmentItem[]
  }
  return db.prepare('SELECT * FROM assessment_items ORDER BY created_at DESC').all() as AssessmentItem[]
}

export async function getAssessment(id: string): Promise<AssessmentItem | undefined> {
  const db = getDb()
  return db.prepare('SELECT * FROM assessment_items WHERE id = ?').get(id) as AssessmentItem | undefined
}

export async function updateRemark(
  itemId: string,
  remark: string,
  directionOverride: string | undefined,
  operator: string,
): Promise<{ item: AssessmentItem; changes: any[] }> {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM assessment_items WHERE id = ?').get(itemId) as AssessmentItem | undefined
  if (!existing) throw new Error('核算条目不存在')

  const changes: any[] = []
  const doUpdate = db.transaction(() => {
    if (existing.remark !== remark) {
      recordChangeSync(itemId, 'remark', existing.remark, remark, operator, '质检员补看手写巡检备注')
      changes.push({ field: 'remark', old: existing.remark, new: remark })
    }

    if (directionOverride !== undefined && existing.direction !== directionOverride) {
      recordChangeSync(itemId, 'direction', existing.direction ?? '', directionOverride, operator, '质检员修改方向')
      changes.push({ field: 'direction', old: existing.direction, new: directionOverride })

      const result = checkBoundarySync('direction', directionOverride)
      if (result.matched && result.rule) {
        const newBoundaryFlag = 1
        if (existing.boundary_flag !== newBoundaryFlag) {
          recordChangeSync(itemId, 'boundary_flag', String(existing.boundary_flag), String(newBoundaryFlag), operator, `边界规则触发：${result.rule.id}`)
          changes.push({ field: 'boundary_flag', old: existing.boundary_flag, new: newBoundaryFlag })
        }
        db.prepare('UPDATE assessment_items SET direction = ?, direction_normalized = ?, boundary_flag = 1, boundary_rule = ?, updated_at = datetime("now", "localtime") WHERE id = ?')
          .run(directionOverride, result.normalizedValue ?? null, result.rule.id, itemId)
      } else {
        if (existing.boundary_flag !== 0) {
          recordChangeSync(itemId, 'boundary_flag', String(existing.boundary_flag), '0', operator, '方向修改后不再触发边界规则')
          changes.push({ field: 'boundary_flag', old: existing.boundary_flag, new: 0 })
        }
        db.prepare('UPDATE assessment_items SET direction = ?, direction_normalized = NULL, boundary_flag = 0, boundary_rule = NULL, updated_at = datetime("now", "localtime") WHERE id = ?')
          .run(directionOverride, itemId)
      }
    }

    let newStatus = existing.status
    if (existing.status === '待补看') {
      newStatus = existing.boundary_flag ? '待实验老师复核' : '已补看'
    } else if (existing.status === '退回' && remark !== existing.remark) {
      newStatus = existing.boundary_flag ? '待实验老师复核' : '已补看'
    }

    if (newStatus !== existing.status) {
      recordChangeSync(itemId, 'status', existing.status, newStatus, operator, '质检员补看备注后自动更新状态')
      changes.push({ field: 'status', old: existing.status, new: newStatus })
    }

    db.prepare('UPDATE assessment_items SET remark = ?, status = ?, updated_at = datetime("now", "localtime") WHERE id = ?')
      .run(remark, newStatus, itemId)
  })

  doUpdate()
  const item = db.prepare('SELECT * FROM assessment_items WHERE id = ?').get(itemId) as AssessmentItem
  return { item, changes }
}

export async function reviewAssessment(
  itemId: string,
  action: 'confirm_abnormal' | 'mark_normal' | 'return_to_inspector',
  reason: string,
  operator: string,
): Promise<AssessmentItem> {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM assessment_items WHERE id = ?').get(itemId) as AssessmentItem | undefined
  if (!existing) throw new Error('核算条目不存在')

  let newStatus: string
  let actionLabel: string

  switch (action) {
    case 'confirm_abnormal':
      newStatus = '已确认异常'
      actionLabel = '实验老师确认异常'
      break
    case 'mark_normal':
      newStatus = '归正常'
      actionLabel = '实验老师归正常'
      break
    case 'return_to_inspector':
      newStatus = '退回'
      actionLabel = '实验老师退回质检员'
      break
    default:
      throw new Error('无效的复核操作')
  }

  const doReview = db.transaction(() => {
    recordChangeSync(itemId, 'status', existing.status, newStatus, operator, `${actionLabel}：${reason}`)

    if (action === 'mark_normal' && existing.boundary_flag) {
      recordChangeSync(itemId, 'boundary_flag', String(existing.boundary_flag), '0', operator, `实验老师归正常，边界标记清除：${reason}`)
    }

    const updateFields = action === 'mark_normal'
      ? 'status = ?, boundary_flag = 0, boundary_rule = NULL, updated_at = datetime("now", "localtime")'
      : 'status = ?, updated_at = datetime("now", "localtime")'

    db.prepare(`UPDATE assessment_items SET ${updateFields} WHERE id = ?`).run(newStatus, itemId)
  })

  doReview()
  return db.prepare('SELECT * FROM assessment_items WHERE id = ?').get(itemId) as AssessmentItem
}

export { getHistoryForItem }
