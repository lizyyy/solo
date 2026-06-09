import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { recordChange } from '../lib/auditEngine.js'
import type { ChangeRecord, HistoryDiff } from '../../shared/types.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const targetType = req.query.target_type as string | undefined
    const targetId = req.query.target_id as string | undefined
    const startTime = req.query.start_time as string | undefined
    const endTime = req.query.end_time as string | undefined
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const offset = (page - 1) * pageSize

    const whereClauses: string[] = []
    const params: unknown[] = []

    if (targetType) {
      whereClauses.push('target_type = ?')
      params.push(targetType)
    }
    if (targetId) {
      whereClauses.push('target_id = ?')
      params.push(targetId)
    }
    if (startTime) {
      whereClauses.push('created_at >= ?')
      params.push(startTime)
    }
    if (endTime) {
      whereClauses.push('created_at <= ?')
      params.push(endTime)
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM change_record ${whereClause}`)
    const total = (countStmt.get(...params) as { cnt: number }).cnt

    const query = `
      SELECT * FROM change_record
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    const records = db.prepare(query).all(...params, pageSize, offset) as ChangeRecord[]

    res.status(200).json({
      success: true,
      data: {
        list: records,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history',
    })
  }
})

function getCurrentRecord(targetType: string, targetId: string): Record<string, unknown> | null {
  let table = ''
  if (targetType === 'sensor') {
    table = 'sensor_data'
  } else if (targetType === 'safety_zone') {
    table = 'safety_zone'
  } else {
    return null
  }

  const record = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(targetId) as Record<string, unknown> | undefined
  return record || null
}

function parseValue(field: string, value: string): unknown {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  if (field.includes('_at') || field === 'version' || field === 'coefficient_manual') {
    if (value === '') return null
    const num = Number(value)
    return isNaN(num) ? value : num
  }

  if (['rpm_min', 'rpm_max', 'coefficient', 'version'].includes(field)) {
    const num = Number(value)
    return isNaN(num) ? value : num
  }

  return value
}

router.get('/:id/diff', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const record = db.prepare('SELECT * FROM change_record WHERE id = ?').get(id) as ChangeRecord | undefined

    if (!record) {
      res.status(404).json({ success: false, error: 'Change record not found' })
      return
    }

    const current = getCurrentRecord(record.target_type, record.target_id)

    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}

    if (current) {
      const field = record.field
      const oldVal = parseValue(field, record.old_value)
      const newVal = parseValue(field, record.new_value)

      before[field] = oldVal
      after[field] = newVal

      for (const [key, value] of Object.entries(current)) {
        if (key !== field) {
          before[key] = value
          after[key] = value
        }
      }
    } else {
      before[record.field] = parseValue(record.field, record.old_value)
      after[record.field] = parseValue(record.field, record.new_value)
    }

    const diff: HistoryDiff = { before, after }

    res.status(200).json({
      success: true,
      data: diff,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get diff',
    })
  }
})

router.post('/:id/rollback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { operator = 'system', reason } = req.body

    const record = db.prepare('SELECT * FROM change_record WHERE id = ?').get(id) as ChangeRecord | undefined

    if (!record) {
      res.status(404).json({ success: false, error: 'Change record not found' })
      return
    }

    let table = ''
    if (record.target_type === 'sensor') {
      table = 'sensor_data'
    } else if (record.target_type === 'safety_zone') {
      table = 'safety_zone'
    } else {
      res.status(400).json({ success: false, error: 'Invalid target type' })
      return
    }

    const current = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(record.target_id)
    if (!current) {
      res.status(404).json({ success: false, error: 'Target record not found' })
      return
    }

    const field = record.field
    const oldValue = record.old_value
    const currentValue = String((current as Record<string, unknown>)[field])

    if (currentValue === oldValue) {
      res.status(400).json({ success: false, error: 'Value is already the same as old value' })
      return
    }

    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

    const tx = db.transaction(() => {
      let updateStmt = db.prepare(`UPDATE ${table} SET ${field} = ?, updated_at = ? WHERE id = ?`)
      updateStmt.run(oldValue, now, record.target_id)

      if (table === 'sensor_data' && field === 'coefficient') {
        const zone = db.prepare('SELECT * FROM safety_zone WHERE sensor_id = ?').get(record.target_id) as any
        if (zone) {
          db.prepare(
            'UPDATE safety_zone SET coefficient = ?, coefficient_source = ?, review_status = ?, updated_at = ? WHERE sensor_id = ?'
          ).run(
            oldValue,
            'auto',
            'approved',
            now,
            record.target_id
          )

          recordChange({
            targetType: 'safety_zone',
            targetId: zone.id,
            field: 'coefficient',
            oldValue: currentValue,
            newValue: oldValue,
            operator,
            reason: reason || 'Rollback from sensor coefficient history',
          })
        }

        db.prepare(
          'UPDATE sensor_data SET coefficient_manual = 0, coefficient_reason = NULL, updated_at = ? WHERE id = ?'
        ).run(now, record.target_id)
      }

      if (table === 'safety_zone' && field === 'coefficient') {
        const zone = db.prepare('SELECT sensor_id FROM safety_zone WHERE id = ?').get(record.target_id) as { sensor_id: string }
        if (zone && zone.sensor_id) {
          db.prepare(
            'UPDATE sensor_data SET coefficient = ?, coefficient_manual = ?, updated_at = ? WHERE id = ?'
          ).run(
            oldValue,
            0,
            now,
            zone.sensor_id
          )

          recordChange({
            targetType: 'sensor',
            targetId: zone.sensor_id,
            field: 'coefficient',
            oldValue: currentValue,
            newValue: oldValue,
            operator,
            reason: reason || 'Rollback from safety_zone coefficient history',
          })
        }
      }

      if (table === 'safety_zone') {
        const zone = db.prepare('SELECT version FROM safety_zone WHERE id = ?').get(record.target_id) as { version: number }
        if (zone) {
          const newVersion = zone.version + 1
          db.prepare('UPDATE safety_zone SET version = ? WHERE id = ?').run(newVersion, record.target_id)

          recordChange({
            targetType: 'safety_zone',
            targetId: record.target_id,
            field: 'version',
            oldValue: zone.version,
            newValue: newVersion,
            operator,
            reason: reason || 'Rollback version increment',
          })
        }
      }

      recordChange({
        targetType: record.target_type,
        targetId: record.target_id,
        field,
        oldValue: currentValue,
        newValue: oldValue,
        operator,
        reason: reason || 'Rollback from history record',
      })
    })

    tx()

    const updatedRecord = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(record.target_id)

    res.status(200).json({
      success: true,
      data: updatedRecord,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rollback',
    })
  }
})

router.get('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const records = db.prepare('SELECT * FROM change_record ORDER BY created_at ASC').all() as ChangeRecord[]

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000'

    let script = '#!/bin/bash\n'
    script += '# Centrifuge Safety Zone System - Change Replay Script\n'
    script += `# Generated at ${new Date().toISOString()}\n`
    script += `# Total changes: ${records.length}\n\n`
    script += `BASE_URL="${baseUrl}"\n\n`

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      script += `# Change ${i + 1}: ${record.target_type} - ${record.field} (${record.created_at})\n`
      script += `# Operator: ${record.operator}\n`
      if (record.reason) {
        script += `# Reason: ${record.reason}\n`
      }

      let endpoint = ''
      let payload: Record<string, unknown> = {}

      if (record.target_type === 'sensor') {
        if (record.field === 'remark') {
          endpoint = `/api/sensors/${record.target_id}/remark`
          payload = {
            remark: record.new_value,
            operator: record.operator,
            reason: record.reason || '',
          }
        } else if (record.field === 'coefficient') {
          endpoint = `/api/sensors/${record.target_id}/coefficient`
          payload = {
            coefficient: parseFloat(record.new_value),
            reason: record.reason || '',
            operator: record.operator,
          }
        }
      } else if (record.target_type === 'safety_zone') {
        if (record.field === 'review_status') {
          endpoint = `/api/safety-zones/${record.target_id}/review`
          const action = record.new_value === 'approved' ? 'approve' : 'rollback'
          payload = {
            action,
            comment: record.reason || 'Replay from history',
            reviewer: record.operator,
          }
        }
      }

      if (endpoint) {
        const jsonPayload = JSON.stringify(payload)
        script += `curl -X PUT "${baseUrl}${endpoint}" \\\n`
        script += `  -H "Content-Type: application/json" \\\n`
        script += `  -d '${jsonPayload}'\n`
      } else {
        script += `# Field "${record.field}" - manual intervention required\n`
        script += `# Old value: ${record.old_value}\n`
        script += `# New value: ${record.new_value}\n`
      }
      script += '\n'
    }

    script += 'echo "All changes replayed successfully!"\n'

    res.setHeader('Content-Type', 'text/x-shellscript')
    res.setHeader('Content-Disposition', 'attachment; filename="replay_changes.sh"')
    res.status(200).send(script)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export script',
    })
  }
})

export default router
