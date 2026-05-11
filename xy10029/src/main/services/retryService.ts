import { run, get, all } from '../database/index'
import {
  FailedOperation,
  RetryStatus,
  PaginationParams,
  PaginatedResult
} from '@shared/types'
import { generateId, getCurrentTimestamp, calculateNextRetry } from '@shared/utils'

export async function recordFailedOperation(
  operationType: string,
  details: string,
  errorMessage: string,
  maxRetries: number = 3
): Promise<FailedOperation> {
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

  await run(`
    INSERT INTO failed_operations (
      id, operation_type, details, error_message, retry_count,
      max_retries, status, last_attempt_at, next_retry_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
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
  ])

  return operation
}

export async function getPendingRetryOperations(): Promise<FailedOperation[]> {
  const now = getCurrentTimestamp()

  const rows = await all<any>(`
    SELECT * FROM failed_operations
    WHERE status IN (?, ?) AND next_retry_at <= ?
    ORDER BY next_retry_at ASC
  `, [RetryStatus.PENDING, RetryStatus.RETRYING, now])

  return rows.map(mapFailedOperation)
}

export async function updateRetryAttempt(
  id: string,
  success: boolean,
  errorMessage?: string
): Promise<FailedOperation | null> {
  const operation = await getFailedOperationById(id)
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

  await run(`
    UPDATE failed_operations SET
      retry_count = ?,
      status = ?,
      last_attempt_at = ?,
      next_retry_at = ?,
      error_message = ?
    WHERE id = ?
  `, [
    newRetryCount,
    newStatus,
    now,
    nextRetryAt,
    errorMessage || operation.errorMessage,
    id
  ])

  return getFailedOperationById(id)
}

export async function cancelRetry(id: string): Promise<FailedOperation | null> {
  await run('UPDATE failed_operations SET status = ? WHERE id = ?', [RetryStatus.CANCELLED, id])
  return getFailedOperationById(id)
}

export async function getFailedOperations(
  params: PaginationParams & { status?: RetryStatus }
): Promise<PaginatedResult<FailedOperation>> {
  const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc', status } = params

  const whereClauses: string[] = []
  const whereParams: any[] = []

  if (status) {
    whereClauses.push('status = ?')
    whereParams.push(status)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countRow = await get<any>(`SELECT COUNT(*) as count FROM failed_operations ${whereSql}`, whereParams)
  const total = countRow?.count || 0

  const offset = (page - 1) * pageSize
  const rows = await all<any>(
    `SELECT * FROM failed_operations ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, offset]
  )

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

  await recordFailedOperation(operationType, details, lastError!.message, maxRetries)
  throw lastError
}

async function getFailedOperationById(id: string): Promise<FailedOperation | null> {
  const row = await get<any>('SELECT * FROM failed_operations WHERE id = ?', [id])
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
