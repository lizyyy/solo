import { db } from './database'
import { LogLevel } from '@prisma/client'

export interface LogData {
  userId: string
  action: string
  module: string
  details: Record<string, any>
  level?: LogLevel
  ipAddress?: string
}

class LoggerService {
  async log(data: LogData) {
    try {
      await db.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          module: data.module,
          details: JSON.stringify(data.details),
          level: data.level || 'INFO',
          ipAddress: data.ipAddress,
        },
      })
    } catch (err) {
      console.error('日志记录失败:', err)
    }
  }

  async info(data: Omit<LogData, 'level'>) {
    return this.log({ ...data, level: 'INFO' })
  }

  async warn(data: Omit<LogData, 'level'>) {
    return this.log({ ...data, level: 'WARN' })
  }

  async error(data: Omit<LogData, 'level'>) {
    return this.log({ ...data, level: 'ERROR' })
  }

  async debug(data: Omit<LogData, 'level'>) {
    return this.log({ ...data, level: 'DEBUG' })
  }

  async getLogs(params: {
    userId?: string
    module?: string
    level?: LogLevel
    startDate?: Date
    endDate?: Date
    skip?: number
    take?: number
  }) {
    const { userId, module, level, startDate, endDate, skip = 0, take = 50 } = params

    const where: any = {}
    if (userId) where.userId = userId
    if (module) where.module = module
    if (level) where.level = level
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, username: true } } },
      }),
      db.auditLog.count({ where }),
    ])

    return { logs, total }
  }
}

export const logger = new LoggerService()
