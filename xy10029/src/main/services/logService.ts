import { getDatabase } from '../database'
import { SystemLog, LogLevel, PaginationParams, PaginatedResult } from '@shared/types'
import { generateId, getCurrentTimestamp } from '@shared/utils'

export function logOperation(
  level: LogLevel,
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string,
  success: boolean,
  errorMessage: string | null = null,
  duration: number = 0
): SystemLog {
  const db = getDatabase()
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

  const stmt = db.prepare(`
    INSERT INTO system_logs (
      id, level, module, action, user_id, user_name, details,
      success, error_message, duration, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
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
  )

  return log
}

export function logInfo(
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string
): SystemLog {
  return logOperation(LogLevel.INFO, module, action, userId, userName, details, true)
}

export function logError(
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string,
  error: Error
): SystemLog {
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

export function logWarn(
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string
): SystemLog {
  return logOperation(LogLevel.WARN, module, action, userId, userName, details, true)
}

export function getLogs(params: PaginationParams & { level?: LogLevel; module?: string; startDate?: string; endDate?: string }): PaginatedResult<SystemLog> {
  const db = getDatabase()
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

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM system_logs ${whereSql}`)
  const total = (countStmt.get(...whereParams) as any).count

  const offset = (page - 1) * pageSize
  const stmt = db.prepare(`
    SELECT * FROM system_logs
    ${whereSql}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(...whereParams, pageSize, offset) as any[]

  return {
    items: rows.map(mapLog),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export function cleanupOldLogs(daysToKeep: number = 90): number {
  const db = getDatabase()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const stmt = db.prepare('DELETE FROM system_logs WHERE timestamp < ?')
  const result = stmt.run(cutoffDate.toISOString())
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
