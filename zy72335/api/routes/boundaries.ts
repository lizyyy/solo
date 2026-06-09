import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const FIELD_LABEL_MAP: Record<string, string> = {
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

function findAffectedResults(_entityType: string, entityId: string): string[] {
  const results: string[] = []
  const boundary = db.prepare('SELECT raw_row_id FROM boundary_specs WHERE id = ?').get(entityId) as any
  if (boundary) {
    results.push(`raw_row:${boundary.raw_row_id}`)
    const calc = db.prepare('SELECT id FROM calculation_details WHERE raw_row_id = ?').get(boundary.raw_row_id) as any
    if (calc) results.push(`calculation:${calc.id}`)
  }
  return results
}

function toCamelCase(boundary: any): any {
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

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  try {
    const { rawRowId, fieldName, minValue, maxValue, unit, description, operator } = req.body
    if (!rawRowId || !fieldName) {
      res.status(400).json({ success: false, error: 'Missing rawRowId or fieldName' })
      return
    }

    const rawRow = db.prepare('SELECT * FROM raw_rows WHERE id = ?').get(rawRowId) as any
    if (!rawRow) {
      res.status(404).json({ success: false, error: 'Raw row not found' })
      return
    }

    const id = uuidv4()
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO boundary_specs (id, raw_row_id, field_name, min_value, max_value, unit, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, rawRowId, fieldName, minValue ?? null, maxValue ?? null, unit ?? '', description ?? '')

      if (!rawRow.boundary_id) {
        db.prepare('UPDATE raw_rows SET boundary_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(id, rawRowId)
      }

      const affected = findAffectedResults('boundary', id)
      if (affected.length > 0) {
        db.prepare(`
          INSERT INTO change_records (id, entity_type, entity_id, field_name, old_value, new_value, reason, changed_by, affected_results)
          VALUES (?, 'raw_row', ?, '边界值说明', '（无）', '已补录', '唐老师补录边界值', ?, ?)
        `).run(uuidv4(), rawRowId, operator || 'system', JSON.stringify(affected))
      }
    })

    transaction()

    const boundary = db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(id) as any
    res.json({ success: true, data: toCamelCase(boundary) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const { rawRowId } = req.query
    let sql = 'SELECT * FROM boundary_specs WHERE 1=1'
    const params: any[] = []

    if (rawRowId) {
      sql += ' AND raw_row_id = ?'
      params.push(rawRowId)
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
    const boundary = db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(req.params.id) as any
    if (!boundary) {
      res.status(404).json({ success: false, error: 'Boundary spec not found' })
      return
    }
    res.json({ success: true, data: toCamelCase(boundary) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: 'Boundary spec not found' })
      return
    }

    const fieldMap: Record<string, string> = {
      fieldName: 'field_name',
      minValue: 'min_value',
      maxValue: 'max_value',
      unit: 'unit',
      description: 'description',
    }

    const reason = req.body.reason || '未填写原因'
    const operator = req.body.operator || 'system'

    const transaction = db.transaction(() => {
      for (const [bodyKey, dbField] of Object.entries(fieldMap)) {
        if (req.body[bodyKey] !== undefined && String(req.body[bodyKey] ?? '') !== String(existing[dbField] ?? '')) {
          const affected = findAffectedResults('boundary', existing.id)
          db.prepare(`
            INSERT INTO change_records (id, entity_type, entity_id, field_name, old_value, new_value, reason, changed_by, affected_results)
            VALUES (?, 'boundary', ?, ?, ?, ?, ?, ?, ?)
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
        }
      }

      const setClauses: string[] = []
      const values: any[] = []

      for (const [bodyKey, dbField] of Object.entries(fieldMap)) {
        if (req.body[bodyKey] !== undefined) {
          setClauses.push(`${dbField} = ?`)
          values.push(req.body[bodyKey])
        }
      }

      if (setClauses.length > 0) {
        setClauses.push("updated_at = datetime('now')")
        values.push(existing.id)
        db.prepare(`UPDATE boundary_specs SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)
      }

      const rawRow = db.prepare('SELECT * FROM raw_rows WHERE id = ?').get(existing.raw_row_id) as any
      if (rawRow && !rawRow.boundary_id) {
        db.prepare('UPDATE raw_rows SET boundary_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(existing.id, existing.raw_row_id)
      }
    })

    transaction()

    const updated = db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(req.params.id) as any
    res.json({ success: true, data: toCamelCase(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const existing = db.prepare('SELECT * FROM boundary_specs WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: 'Boundary spec not found' })
      return
    }

    const transaction = db.transaction(() => {
      db.prepare('UPDATE raw_rows SET boundary_id = NULL, updated_at = datetime(\'now\') WHERE boundary_id = ?').run(existing.id)
      db.prepare('DELETE FROM boundary_specs WHERE id = ?').run(existing.id)
    })

    transaction()
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
