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

        const hasMixed = (row.percentageValue && row.decimalValue) ? 1 : 0
        insertRow.run(
          uuidv4(),
          row.uniqueKey,
          row.content,
          row.percentageValue ?? null,
          row.decimalValue ?? null,
          hasMixed,
          batchId
        )
        newRows++
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
    res.json({ success: true, data: rows.map(toCamelCase) })
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

    const transaction = db.transaction(() => {
      for (const [bodyKey, dbField] of Object.entries(fieldMap)) {
        if (req.body[bodyKey] !== undefined && req.body[bodyKey] !== existing[dbField]) {
          db.prepare(`
            INSERT INTO change_records (id, entity_type, entity_id, field_name, old_value, new_value, reason, changed_by)
            VALUES (?, 'raw_row', ?, ?, ?, ?, ?, 'system')
          `).run(uuidv4(), existing.id, dbField, String(existing[dbField] ?? ''), String(req.body[bodyKey]))
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
