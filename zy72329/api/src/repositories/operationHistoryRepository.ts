import { db } from '../db'
import type { OperationHistory, OperationType } from '../../../shared/types'

interface OperationHistoryRow {
  id: string
  record_id: string | null
  operation_type: string
  description: string
  operator: string
  operator_role: string
  before_state: string | null
  after_state: string | null
  next_handler: string | null
  reason: string | null
  created_at: string
}

function rowToOperationHistory(row: OperationHistoryRow): OperationHistory {
  return {
    id: row.id,
    recordId: row.record_id ?? undefined,
    operationType: row.operation_type as OperationType,
    description: row.description,
    operator: row.operator,
    operatorRole: row.operator_role,
    beforeState: row.before_state ? JSON.parse(row.before_state) : undefined,
    afterState: row.after_state ? JSON.parse(row.after_state) : undefined,
    nextHandler: row.next_handler ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at
  }
}

function operationHistoryToRow(history: OperationHistory): unknown[] {
  return [
    history.id,
    history.recordId ?? null,
    history.operationType,
    history.description,
    history.operator,
    history.operatorRole,
    history.beforeState ? JSON.stringify(history.beforeState) : null,
    history.afterState ? JSON.stringify(history.afterState) : null,
    history.nextHandler ?? null,
    history.reason ?? null,
    history.createdAt
  ]
}

const insertStmt = db.prepare(`
  INSERT INTO operation_histories (
    id, record_id, operation_type, description, operator,
    operator_role, before_state, after_state, next_handler, reason, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const findByRecordIdStmt = db.prepare(`
  SELECT * FROM operation_histories WHERE record_id = ? ORDER BY created_at DESC
`)

const findAllStmt = db.prepare(`
  SELECT * FROM operation_histories ORDER BY created_at DESC
`)

const findByIdStmt = db.prepare(`
  SELECT * FROM operation_histories WHERE id = ?
`)

const countStmt = db.prepare(`
  SELECT COUNT(*) as count FROM operation_histories
`)

export function insert(history: OperationHistory): string {
  insertStmt.run(...operationHistoryToRow(history))
  return history.id
}

export function findAll(filters?: {
  recordId?: string
  operator?: string
  startDate?: string
  endDate?: string
}): OperationHistory[] {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.recordId) {
    conditions.push('record_id = ?')
    params.push(filters.recordId)
  }
  if (filters?.operator) {
    conditions.push('operator = ?')
    params.push(filters.operator)
  }
  if (filters?.startDate) {
    conditions.push('created_at >= ?')
    params.push(filters.startDate)
  }
  if (filters?.endDate) {
    conditions.push('created_at <= ?')
    params.push(filters.endDate)
  }

  let sql = 'SELECT * FROM operation_histories'
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY created_at DESC'

  const stmt = db.prepare(sql)
  const rows = stmt.all(...params) as OperationHistoryRow[]
  return rows.map(rowToOperationHistory)
}

export function findByRecordId(recordId: string): OperationHistory[] {
  const rows = findByRecordIdStmt.all(recordId) as OperationHistoryRow[]
  return rows.map(rowToOperationHistory)
}

export function findById(id: string): OperationHistory | undefined {
  const row = findByIdStmt.get(id) as OperationHistoryRow | undefined
  return row ? rowToOperationHistory(row) : undefined
}

export function count(): number {
  const result = countStmt.get() as { count: number }
  return result.count
}

interface OperationHistoryCreate {
  recordId?: string
  operationType: OperationType
  description: string
  operator: string
  operatorRole: string
  beforeState?: Record<string, any>
  afterState?: Record<string, any>
  nextHandler?: string
  reason?: string
}

export function create(data: OperationHistoryCreate): OperationHistory {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const history: OperationHistory = {
    id,
    ...data,
    createdAt: now
  }
  insertStmt.run(...operationHistoryToRow(history))
  return findById(id)!
}
