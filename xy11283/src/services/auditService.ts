import { runQuery, allQuery } from '../database';
import { AuditLog } from '../models';
import { maskSensitiveData } from '../utils/security';

export async function createAuditLog(
  entityType: string,
  entityId: number | undefined,
  action: string,
  oldValue: any,
  newValue: any,
  operatorId?: string,
  operatorName?: string,
  ipAddress?: string
): Promise<void> {
  const oldStr = oldValue ? JSON.stringify(maskSensitiveData(oldValue)) : null;
  const newStr = newValue ? JSON.stringify(maskSensitiveData(newValue)) : null;

  await runQuery(
    `INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, operator_id, operator_name, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, action, oldStr, newStr, operatorId, operatorName, ipAddress]
  );
}

export async function getAuditLogs(
  entityType?: string,
  entityId?: number,
  action?: string,
  limit: number = 100,
  offset: number = 0
): Promise<AuditLog[]> {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (entityId) {
    sql += ' AND entity_id = ?';
    params.push(entityId);
  }

  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = await allQuery(sql, params);
  return logs.map(log => maskSensitiveData(log));
}

export async function getAuditLogStats(days: number = 30): Promise<any> {
  const sql = `
    SELECT 
      entity_type,
      action,
      COUNT(*) as count,
      DATE(created_at) as date
    FROM audit_logs 
    WHERE created_at >= datetime('now', '-? days')
    GROUP BY entity_type, action, DATE(created_at)
    ORDER BY date DESC
  `;

  return await allQuery(sql, [days]);
}
