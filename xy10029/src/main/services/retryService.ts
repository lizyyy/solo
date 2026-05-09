import { getDatabase, beginTransaction, commitTransaction, rollbackTransaction } from '../database'
import {
  FailedOperation,
  RetryStatus,
  PaginationParams,
  PaginatedResult
} from '@shared/types'
import { generateId, getCurrentTimestamp, calculateNextRetry } from '@shared/utils'

export function recordFailedOperation(
  operationType: string,
  details: string,
  errorMessage: string,
  maxRetries: number = 3
): FailedOperation {
  const db = getDatabase()
  const now = getCurrentTimestamp()

  const operation: FailedOperation = {
    id: generateId(),
    operationType,
    details,
    errorMessage,
    retryCount: 0,
    maxRetries,
    status: RetryStatus.PENDING,
    lastAttemptAt: now,
    nextRetryAt: calculateNextRetry(0, now),
    createdAt: now
  }

  const stmt = db.prepare(`
    INSERT INTO failed_operations (
      id, operation_type, details, error_message, retry_count,
      max_retries, status, last_attempt_at, next_retry_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    operation.id,
    operation.operationType,
    operation.details,
    operation.errorMessage,
    operation.retryCount,
    operation.maxRetries,
    operation.status,
    operation.lastAttemptAt,
    operation.nextRetryAt,
    operation.createdAt
  )

  return operation
}

export function getPendingRetryOperations(): FailedOperation[] {
  const db = getDatabase()
  const now = getCurrentTimestamp()

  const stmt = db.prepare(`
    SELECT * FROM failed_operations
    WHERE status IN (?, ?) AND next_retry_at <= ?
    ORDER BY next_retry_at ASC
  `)
  const rows = stmt.all(RetryStatus.PENDING, RetryStatus.RETRYING, now) as any[]
  return rows.map(mapFailedOperation)
}

export function updateRetryAttempt(
  id: string,
  success: boolean,
  errorMessage?: string
): FailedOperation | null {
  const db = getDatabase()
  const operation = getFailedOperationById(id)
  if (!operation) return null

  const now = getCurrentTimestamp()
  const newRetryCount = operation.retryCount + 1

  let newStatus: RetryStatus
  let nextRetryAt: string | null = null

  if (success) {
    newStatus = RetryStatus.SUCCESS
  } else if (newRetryCount >= operation.maxRetries) {
    newStatus = RetryStatus.FAILED
  } else {
    newStatus = RetryStatus.RETRYING
    nextRetryAt = calculateNextRetry(newRetryCount, now)
  }

  const stmt = db.prepare(`
    UPDATE failed_operations SET
      retry_count = ?,
      status = ?,
      last_attempt_at = ?,
      next_retry_at = ?,
      error_message = ?
    WHERE id = ?
  `)
  stmt.run(
    newRetryCount,
    newStatus,
    now,
    nextRetryAt,
    errorMessage || operation.errorMessage,
    id
  )

  return getFailedOperationById(id)
}

export function cancelRetry(id: string): FailedOperation | null {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE failed_operations SET status = ? WHERE id = ?')
  stmt.run(RetryStatus.CANCELLED, id)
  return getFailedOperationById(id)
}

export function getFailedOperations(params: PaginationParams & { status?: RetryStatus }): PaginatedResult<FailedOperation> {
  const db = getDatabase()
  const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc', status } = params

  const whereClauses: string[] = []
  const whereParams: any[] = []

  if (status) {
    whereClauses.push('status = ?')
    whereParams.push(status)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM failed_operations ${whereSql}`)
  const total = (countStmt.get(...whereParams) as any).count

  const offset = (page - 1) * pageSize
  const stmt = db.prepare(`
    SELECT * FROM failed_operations
    ${whereSql}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(...whereParams, pageSize, offset) as any[]

  return {
    items: rows.map(mapFailedOperation),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export async function executeWithRetry<T>(
  operation: () => Promise<T> | T,
  operationType: string,
  details: string,
  maxRetries: number = 3,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (onRetry) {
        onRetry(attempt + 1, lastError)
      }

      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  recordFailedOperation(operationType, details, lastError!.message, maxRetries)
  throw lastError
}

function getFailedOperationById(id: string): FailedOperation | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM failed_operations WHERE id = ?')
  const row = stmt.get(id) as any
  return row ? mapFailedOperation(row) : null
}

function mapFailedOperation(row: any): FailedOperation {
  return {
    id: row.id,
    operationType: row.operation_type,
    details: row.details,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    status: row.status as RetryStatus,
    lastAttemptAt: row.last_attempt_at,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at
  }
}
