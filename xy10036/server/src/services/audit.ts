import { v4 as uuidv4 } from 'uuid'
import { db } from '../database'
import type { AuditAction, EntityType, AuditLog } from '../../shared/types'

export interface AuditLogParams {
  action: AuditAction
  entityType: EntityType
  entityId: string
  entityName?: string
  operatorId: string
  operatorName: string
  before?: Record<string, any>
  after?: Record<string, any>
  requestId: string
  ip?: string
  userAgent?: string
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  const now = new Date().toISOString()

  await db.run(
    `INSERT INTO audit_logs (
      id, action, entity_type, entity_id, entity_name, 
      operator_id, operator_name, before, after, 
      request_id, ip, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.action,
      params.entityType,
      params.entityId,
      params.entityName,
      params.operatorId,
      params.operatorName,
      params.before ? JSON.stringify(params.before) : null,
      params.after ? JSON.stringify(params.after) : null,
      params.requestId,
      params.ip,
      params.userAgent,
      now
    ]
  )
}

export interface AuditLogQuery {
  entityType?: EntityType
  entityId?: string
  operatorId?: string
  action?: AuditAction
  startTime?: string
  endTime?: string
  page: number
  pageSize: number
}

export async function getAuditLogs(query: AuditLogQuery): Promise<{
  items: AuditLog[]
  total: number
}> {
  const conditions: string[] = []
  const params: any[] = []

  if (query.entityType) {
    conditions.push('entity_type = ?')
    params.push(query.entityType)
  }
  if (query.entityId) {
    conditions.push('entity_id = ?')
    params.push(query.entityId)
  }
  if (query.operatorId) {
    conditions.push('operator_id = ?')
    params.push(query.operatorId)
  }
  if (query.action) {
    conditions.push('action = ?')
    params.push(query.action)
  }
  if (query.startTime) {
    conditions.push('created_at >= ?')
    params.push(query.startTime)
  }
  if (query.endTime) {
    conditions.push('created_at <= ?')
    params.push(query.endTime)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await db.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
    params
  )

  const offset = (query.page - 1) * query.pageSize
  const rows = await db.all<DbAuditLog>(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, query.pageSize, offset]
  )

  return {
    items: rows.map(mapDbAuditLog),
    total: countResult?.total || 0
  }
}

interface DbAuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  entity_name?: string
  operator_id: string
  operator_name: string
  before?: string
  after?: string
  request_id: string
  ip?: string
  user_agent?: string
  created_at: string
}

function mapDbAuditLog(row: DbAuditLog): AuditLog {
  return {
    id: row.id,
    action: row.action as AuditAction,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    entityName: row.entity_name,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    before: row.before ? JSON.parse(row.before) : undefined,
    after: row.after ? JSON.parse(row.after) : undefined,
    requestId: row.request_id,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at
  }
}
