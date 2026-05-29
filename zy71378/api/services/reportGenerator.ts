import type Database from 'better-sqlite3'

export interface AuditReport {
  total_callbacks: number
  signature_valid: number
  signature_expired: number
  signature_invalid: number
  signature_pending: number
  duplicates: number
  status_regressions: number
  pending_confirmations: number
  replay_success: number
  replay_failed: number
  generated_at: string
}

export interface CallbackRecord {
  id: string
  webhook_id: string
  timestamp: string
  signature_header: string | null
  signature_status: string
  retry_count: number
  order_id: string
  order_status: string
  previous_status: string | null
  processing_result: string
  raw_payload: string | null
  confirm_status: string
  confirm_note: string | null
  created_at: string
  updated_at: string
}

export function generateAuditReport(db: Database.Database, whereClause: string = '', params: any[] = []): AuditReport {
  const baseWhere = whereClause ? ` WHERE ${whereClause}` : ''

  const total = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records${baseWhere}`).get(...params) as any).count) || 0
  const signature_valid = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE signature_status = 'valid'${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0
  const signature_expired = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE signature_status = 'expired'${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0
  const signature_invalid = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE signature_status = 'invalid'${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0
  const signature_pending = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE signature_status = 'pending'${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0
  const duplicates = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE processing_result = 'duplicate'${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0
  const status_regressions = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE previous_status IS NOT NULL AND order_status != previous_status${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0
  const pending_confirmations = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records WHERE confirm_status = 'pending'${whereClause ? ` AND (${whereClause})` : ''}`).get(...params) as any).count) || 0

  const replaySuccess = ((db.prepare(`SELECT COUNT(*) as count FROM replay_tasks WHERE status = 'completed'`).get() as any).count) || 0
  const replayFailed = ((db.prepare(`SELECT COUNT(*) as count FROM replay_tasks WHERE status = 'failed'`).get() as any).count) || 0

  return {
    total_callbacks: total,
    signature_valid,
    signature_expired,
    signature_invalid,
    signature_pending,
    duplicates,
    status_regressions,
    pending_confirmations,
    replay_success: replaySuccess,
    replay_failed: replayFailed,
    generated_at: new Date().toISOString(),
  }
}

export function exportAsCsv(records: CallbackRecord[]): string {
  const headers = [
    'id', 'webhook_id', 'timestamp', 'signature_header', 'signature_status',
    'retry_count', 'order_id', 'order_status', 'previous_status',
    'processing_result', 'raw_payload', 'confirm_status', 'confirm_note',
    'created_at', 'updated_at'
  ]
  const rows = records.map(r =>
    headers.map(h => {
      const val = (r as any)[h]
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export function exportAsJson(records: CallbackRecord[]): string {
  return JSON.stringify(records, null, 2)
}
