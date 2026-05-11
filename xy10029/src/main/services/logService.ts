import { run, get, all } from '../database/index'
import { SystemLog, LogLevel, PaginationParams, PaginatedResult } from '@shared/types'
import { generateId, getCurrentTimestamp } from '@shared/utils'

export async function logOperation(
  level: LogLevel,
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string,
  success: boolean,
  errorMessage: string | null = null,
  duration: number = 0
): Promise<SystemLog> {
  const now = getCurrentTimestamp()

  const log: SystemLog = {
    id: generateId(),
    level,
    module,
    action,
    userId,
    userName,
    details,
    success,
    errorMessage,
    duration,
    timestamp: now
  }

  await run(`
    INSERT INTO system_logs (
      id, level, module, action, user_id, user_name, details,
      success, error_message, duration, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    log.id,
    log.level,
    log.module,
    log.action,
    log.userId,
    log.userName,
    log.details,
    log.success ? 1 : 0,
    log.errorMessage,
    log.duration,
    log.timestamp
  ])

  return log
}

export async function logInfo(
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string
): Promise<SystemLog> {
  return logOperation(LogLevel.INFO, module, action, userId, userName, details, true)
}

export async function logError(
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string,
  error: Error
): Promise<SystemLog> {
  return logOperation(
    LogLevel.ERROR,
    module,
    action,
    userId,
    userName,
    details,
    false,
    error.message
  )
}

export async function logWarn(
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string
): Promise<SystemLog> {
  return logOperation(LogLevel.WARN, module, action, userId, userName, details, true)
}

export async function getLogs(
  params: PaginationParams & { level?: LogLevel; module?: string; startDate?: string; endDate?: string }
): Promise<PaginatedResult<SystemLog>> {
  const { page, pageSize, sortBy = 'timestamp', sortOrder = 'desc', level, module, startDate, endDate } = params

  const whereClauses: string[] = []
  const whereParams: any[] = []

  if (level) {
    whereClauses.push('level = ?')
    whereParams.push(level)
  }
  if (module) {
    whereClauses.push('module = ?')
    whereParams.push(module)
  }
  if (startDate) {
    whereClauses.push('timestamp >= ?')
    whereParams.push(startDate)
  }
  if (endDate) {
    whereClauses.push('timestamp <= ?')
    whereParams.push(endDate)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countRow = await get<any>(`SELECT COUNT(*) as count FROM system_logs ${whereSql}`, whereParams)
  const total = countRow?.count || 0

  const offset = (page - 1) * pageSize
  const rows = await all<any>(
    `SELECT * FROM system_logs ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, offset]
  )

  return {
    items: rows.map(mapLog),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export async function cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await run(
    'DELETE FROM system_logs WHERE timestamp < ?',
    [cutoffDate.toISOString()]
  )
  return result.changes
}

function mapLog(row: any): SystemLog {
  return {
    id: row.id,
    level: row.level as LogLevel,
    module: row.module,
    action: row.action,
    userId: row.user_id,
    userName: row.user_name,
    details: row.details,
    success: row.success === 1,
    errorMessage: row.error_message,
    duration: row.duration,
    timestamp: row.timestamp
  }
}
