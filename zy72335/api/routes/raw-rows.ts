import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

function toCamelCase(row: any): any {
  return {
    id: row.id,
    uniqueKey: row.unique_key,
    content: row.content,
    percentageValue: row.percentage_value,
    decimalValue: row.decimal_value,
    hasMixedFormat: !!row.has_mixed_format,
    boundaryId: row.boundary_id,
    importBatchId: row.import_batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCamelCaseBoundary(boundary: any): any {
  return {
    id: boundary.id,
    rawRowId: boundary.raw_row_id,
    fieldName: boundary.field_name,
    minValue: boundary.min_value,
    maxValue: boundary.max_value,
    unit: boundary.unit,
    description: boundary.description,
    createdAt: boundary.created_at,
    updatedAt: boundary.updated_at,
  }
}

function toCamelCaseCalculation(calc: any): any {
  return {
    id: calc.id,
    rawRowId: calc.raw_row_id,
    kept: !!calc.kept,
    keepReason: calc.keep_reason,
    missingMaterials: JSON.parse(calc.missing_materials || '[]'),
    nextAction: calc.next_action,
    mixedFormatFlagged: !!calc.mixed_format_flagged,
    reviewStatus: calc.review_status,
    reviewedBy: calc.reviewed_by,
    reviewedAt: calc.reviewed_at,
    createdAt: calc.created_at,
    updatedAt: calc.updated_at,
  }
}

const FIELD_LABEL_MAP: Record<string, string> = {
  content: '内容',
  percentage_value: '百分数值',
  percentageValue: '百分数值',
  decimal_value: '小数值',
  decimalValue: '小数值',
  field_name: '字段名称',
  fieldName: '字段名称',
  min_value: '最小值',
  minValue: '最小值',
  max_value: '最大值',
  maxValue: '最大值',
  unit: '单位',
  description: '描述说明',
}

function fieldLabel(field: string): string {
  return FIELD_LABEL_MAP[field] || field
}

function findAffectedResults(entityType: string, entityId: string): string[] {
  const results: string[] = []
  if (entityType === 'raw_row') {
    const calc = db.prepare('SELECT id FROM calculation_details WHERE raw_row_id = ?').get(entityId) as any
    if (calc) results.push(`calculation:${calc.id}`)
  }
  if (entityType === 'boundary') {
    const boundary = db.prepare('SELECT raw_row_id FROM boundary_specs WHERE id = ?').get(entityId) as any
    if (boundary) {
      results.push(`raw_row:${boundary.raw_row_id}`)
      const calc = db.prepare('SELECT id FROM calculation_details WHERE raw_row_id = ?').get(boundary.raw_row_id) as any
      if (calc) results.push(`calculation:${calc.id}`)
    }
  }
  return results
}

const router = Router()

router.post('/import', (req: Request, res: Response): void => {
  try {
    const { rows, operator } = req.body
    if (!Array.isArray(rows) || !operator) {
      res.status(400).json({ success: false, error: 'Missing rows or operator' })
      return
    }

    const batchId = uuidv4()
    const logId = uuidv4()
    let newRows = 0
    let skippedRows = 0

    const insertRow = db.prepare(`
      INSERT INTO raw_rows (id, unique_key, content, percentage_value, decimal_value, has_mixed_format, import_batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const insertLog = db.prepare(`
      INSERT INTO import_logs (id, batch_id, operator, total_rows, new_rows, skipped_rows, conflict_rows)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `)

    const transaction = db.transaction(() => {
      insertLog.run(logId, batchId, operator, rows.length, 0, 0)

      for (const row of rows) {
        const existing = db.prepare('SELECT id FROM raw_rows WHERE unique_key = ?').get(row.uniqueKey) as any
        if (existing) {
          skippedRows++
          continue
        }

        const rowId = uuidv4()
        const hasMixed = (row.percentageValue && row.decimalValue) ? 1 : 0
        insertRow.run(
          rowId,
          row.uniqueKey,
          row.content,
          row.percentageValue ?? null,
          row.decimalValue ?? null,
          hasMixed,
          batchId
        )
        newRows++

        const fields = [
          { name: '内容', value: row.content || '' },
          { name: '百分数', value: row.percentageValue || '（无）' },
          { name: '小数', value: row.decimalValue || '（无）' },
          { name: '混合格式标记', value: hasMixed ? '是' : '否' },
        ]
        for (const f of fields) {
          db.prepare(`
            INSERT INTO change_records (id, entity_type, entity_id, field_name, old_value, new_value, reason, changed_by, affected_results)
            VALUES (?, 'raw_row', ?, ?, '（无）', ?, '问卷原始行导入', ?, '[]')
          `).run(uuidv4(), rowId, f.name, String(f.value), operator)
        }
      }

      db.prepare(`
        UPDATE import_logs SET total_rows = ?, new_rows = ?, skipped_rows = ? WHERE batch_id = ?
      `).run(rows.length, newRows, skippedRows, batchId)
    })

    transaction()

    res.json({
      success: true,
      data: {
        batchId,
        newRows,
        skippedRows,
        totalRows: rows.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const { mixedFormat, hasBoundary } = req.query
    let sql = 'SELECT * FROM raw_rows WHERE 1=1'
    const params: any[] = []

    if (mixedFormat === 'true') {
      sql += ' AND has_mixed_format = 1'
    }

    if (hasBoundary === 'true') {
      sql += ' AND boundary_id IS NOT NULL'
    } else if (hasBoundary === 'false') {
      sql += ' AND boundary_id IS NULL'
    }

    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params) as any[]
    const camelRows = rows.map(toCamelCase)
    const withRelations = camelRows.map((row: any) => {
      if (row.boundaryId) {
        const boundary = db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(row.boundaryId) as any
        if (boundary) row.boundary = toCamelCaseBoundary(boundary)
      }
      return row
    })
    res.json({ success: true, data: withRelations })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const row = db.prepare('SELECT * FROM raw_rows WHERE id = ?').get(req.params.id) as any
    if (!row) {
      res.status(404).json({ success: false, error: 'Raw row not found' })
      return
    }

    let boundary = null
    if (row.boundary_id) {
      boundary = toCamelCaseBoundary(db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(row.boundary_id) as any)
    }

    const calcRow = db.prepare('SELECT * FROM calculation_details WHERE raw_row_id = ?').get(row.id) as any
    const calculation = calcRow ? toCamelCaseCalculation(calcRow) : null

    res.json({ success: true, data: { ...toCamelCase(row), boundary, calculation } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM raw_rows WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: 'Raw row not found' })
      return
    }

    const updates: Record<string, any> = {}
    const fieldMap: Record<string, string> = {
      content: 'content',
      percentageValue: 'percentage_value',
      decimalValue: 'decimal_value',
    }

    const reason = req.body.reason || '未填写原因'
    const operator = req.body.operator || 'system'

    const transaction = db.transaction(() => {
      for (const [bodyKey, dbField] of Object.entries(fieldMap)) {
        if (req.body[bodyKey] !== undefined && String(req.body[bodyKey] ?? '') !== String(existing[dbField] ?? '')) {
          const affected = findAffectedResults('raw_row', existing.id)
          db.prepare(`
            INSERT INTO change_records (id, entity_type, entity_id, field_name, old_value, new_value, reason, changed_by, affected_results)
            VALUES (?, 'raw_row', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            existing.id,
            fieldLabel(bodyKey),
            String(existing[dbField] ?? ''),
            String(req.body[bodyKey] ?? ''),
            reason,
            operator,
            JSON.stringify(affected)
          )
          updates[dbField] = req.body[bodyKey]
        }
      }

      const hasMixed = (
        (updates.percentage_value ?? existing.percentage_value) &&
        (updates.decimal_value ?? existing.decimal_value)
      ) ? 1 : 0

      const setClauses: string[] = []
      const values: any[] = []

      for (const [dbField, value] of Object.entries(updates)) {
        setClauses.push(`${dbField} = ?`)
        values.push(value)
      }

      setClauses.push('has_mixed_format = ?')
      values.push(hasMixed)

      setClauses.push("updated_at = datetime('now')")
      values.push(existing.id)

      db.prepare(`UPDATE raw_rows SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)
    })

    transaction()

    const updated = db.prepare('SELECT * FROM raw_rows WHERE id = ?').get(req.params.id) as any
    res.json({ success: true, data: toCamelCase(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM raw_rows WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: 'Raw row not found' })
      return
    }

    db.prepare('DELETE FROM raw_rows WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
