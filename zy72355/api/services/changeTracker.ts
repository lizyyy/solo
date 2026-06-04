import { getDb } from '../database.js'
import { v4 as uuidv4 } from 'uuid'

export interface ChangeRecord {
  id: string
  item_id: string
  field: string
  old_value: string
  new_value: string
  changed_by: string
  changed_at: string
  reason: string | null
}

export async function recordChange(
  itemId: string,
  field: string,
  oldValue: string | null | undefined,
  newValue: string | null | undefined,
  changedBy: string,
  reason?: string,
): Promise<ChangeRecord> {
  const db = getDb()
  const id = uuidv4()
  const oldVal = oldValue ?? ''
  const newVal = newValue ?? ''

  if (oldVal === newVal) {
    return {
      id,
      item_id: itemId,
      field,
      old_value: oldVal,
      new_value: newVal,
      changed_by: changedBy,
      changed_at: new Date().toISOString(),
      reason: reason ?? null,
    }
  }

  const record: ChangeRecord = {
    id,
    item_id: itemId,
    field,
    old_value: oldVal,
    new_value: newVal,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
    reason: reason ?? null,
  }

  db.prepare(`
    INSERT INTO change_records (id, item_id, field, old_value, new_value, changed_by, changed_at, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, itemId, field, oldVal, newVal, changedBy, record.changed_at, reason ?? null)

  return record
}

export async function getHistoryForItem(itemId: string): Promise<ChangeRecord[]> {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM change_records WHERE item_id = ? ORDER BY changed_at DESC',
  ).all(itemId) as ChangeRecord[]
}
