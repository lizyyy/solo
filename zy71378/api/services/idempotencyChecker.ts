import type Database from 'better-sqlite3'

export function checkIdempotency(
  orderId: string,
  currentCallbackId: string,
  db: Database.Database
): { isDuplicate: boolean; existingCallbackId: string | null } {
  const row = db.prepare(
    "SELECT id FROM callback_records WHERE order_id = ? AND id != ? AND processing_result = 'success' LIMIT 1"
  ).get(orderId, currentCallbackId) as { id: string } | undefined

  if (row) {
    return { isDuplicate: true, existingCallbackId: row.id }
  }

  const duplicatePending = db.prepare(
    "SELECT id FROM callback_records WHERE order_id = ? AND id != ? AND confirm_status = 'pending' LIMIT 1"
  ).get(orderId, currentCallbackId) as { id: string } | undefined

  if (duplicatePending) {
    return { isDuplicate: true, existingCallbackId: duplicatePending.id }
  }

  return { isDuplicate: false, existingCallbackId: null }
}
