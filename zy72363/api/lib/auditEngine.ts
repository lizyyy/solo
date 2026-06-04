import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import type { ChangeRecord } from '../../shared/types.js'

interface RecordChangeParams {
  targetType: 'sensor' | 'safety_zone'
  targetId: string
  field: string
  oldValue: unknown
  newValue: unknown
  operator?: string
  reason?: string | null
}

export function recordChange({
  targetType,
  targetId,
  field,
  oldValue,
  newValue,
  operator = 'system',
  reason = null,
}: RecordChangeParams): ChangeRecord {
  const oldStr = oldValue === null || oldValue === undefined ? '' : String(oldValue)
  const newStr = newValue === null || newValue === undefined ? '' : String(newValue)

  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

  const stmt = db.prepare(
    'INSERT INTO change_record (id, target_type, target_id, field, old_value, new_value, operator, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  stmt.run(id, targetType, targetId, field, oldStr, newStr, operator, reason, now)

  return {
    id,
    target_type: targetType,
    target_id: targetId,
    field,
    old_value: oldStr,
    new_value: newStr,
    operator,
    reason,
    created_at: now,
  }
}

export function recordChanges(changes: Omit<RecordChangeParams, 'operator' | 'reason'>[] & { operator?: string; reason?: string | null }[]): ChangeRecord[] {
  const results: ChangeRecord[] = []
  const operator = changes[0]?.operator || 'system'
  const reason = changes[0]?.reason || null

  for (const change of changes) {
    results.push(
      recordChange({
        ...change,
        operator,
        reason,
      })
    )
  }
  return results
}
