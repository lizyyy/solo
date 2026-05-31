import { getDb } from '../database.js'
import { v4 as uuidv4 } from 'uuid'
import type { DepositRecord, RecordSummary } from '../../shared/types.js'

interface FindAllFilters {
  status?: string
  min_amount?: number
  max_amount?: number
  start_date?: string
  end_date?: string
  keyword?: string
}

interface FindAllResult {
  records: DepositRecord[]
  summary: RecordSummary
}

export function findAll(filters: FindAllFilters = {}): FindAllResult {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }
  if (filters.min_amount !== undefined) {
    conditions.push('amount >= ?')
    params.push(filters.min_amount)
  }
  if (filters.max_amount !== undefined) {
    conditions.push('amount <= ?')
    params.push(filters.max_amount)
  }
  if (filters.start_date) {
    conditions.push('created_at >= ?')
    params.push(filters.start_date)
  }
  if (filters.end_date) {
    conditions.push('created_at <= ?')
    params.push(filters.end_date)
  }
  if (filters.keyword) {
    conditions.push('(unit_name LIKE ? OR source LIKE ? OR original_remark LIKE ?)')
    const kw = `%${filters.keyword}%`
    params.push(kw, kw, kw)
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const records = db.prepare(`SELECT * FROM deposit_records ${where} ORDER BY created_at DESC`).all(...params) as DepositRecord[]

  const summaryRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END), 0) as confirmed_total,
      COALESCE(SUM(CASE WHEN status = 'suspended' THEN amount ELSE 0 END), 0) as suspended_total,
      COUNT(*) as total_count
    FROM deposit_records ${where}
  `).get(...params) as RecordSummary

  return { records, summary: summaryRow }
}

export function findById(id: string): DepositRecord | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM deposit_records WHERE id = ?').get(id) as DepositRecord | undefined
}

export function create(data: Omit<DepositRecord, 'id' | 'created_at' | 'updated_at'>): DepositRecord {
  const db = getDb()
  const id = uuidv4()

  db.prepare(`
    INSERT INTO deposit_records (id, unit_name, amount, deposit_type, status, source, original_remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.unit_name, data.amount, data.deposit_type, data.status, data.source, data.original_remark)

  db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, old_status, new_status, reason, diff_summary, operator)
    VALUES (?, ?, 'create', '', ?, '初始录入', ?, '资金组')
  `).run(uuidv4(), id, data.status, `创建记录，状态: ${data.status}`)

  return findById(id)!
}

export function updateStatus(id: string, newStatus: string): void {
  const db = getDb()
  db.prepare(`
    UPDATE deposit_records SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(newStatus, id)
}

export function updateRemark(id: string, remark: string): void {
  const db = getDb()
  db.prepare(`
    UPDATE deposit_records SET original_remark = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(remark, id)
}

export function getLastAuditLog(recordId: string): { old_status: string; new_status: string; action: string } | undefined {
  const db = getDb()
  return db.prepare('SELECT old_status, new_status, action FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC LIMIT 1').get(recordId) as { old_status: string; new_status: string; action: string } | undefined
}
