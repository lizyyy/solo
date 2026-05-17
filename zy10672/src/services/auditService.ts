import pool from '../config/database';
import { ApprovalAction, CommandStatus, AuditLog } from '../types';

export class AuditService {
  static async log(
    commandId: string | undefined,
    action: ApprovalAction,
    operatorId: string,
    operatorName: string,
    fromStatus?: CommandStatus,
    toStatus?: CommandStatus,
    remark?: string,
    changeDetails?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO audit_logs (
        command_id, action, operator_id, operator_name, from_status, to_status,
        remark, change_details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [commandId, action, operatorId, operatorName, fromStatus, toStatus,
       remark, changeDetails ? JSON.stringify(changeDetails) : null, ipAddress, userAgent]
    );
  }

  static async getCommandHistory(commandId: string): Promise<AuditLog[]> {
    const result = await pool.query(
      `SELECT * FROM audit_logs WHERE command_id = $1 ORDER BY created_at DESC`,
      [commandId]
    );
    return result.rows;
  }

  static async listAuditLogs(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      action?: ApprovalAction;
      operatorId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM audit_logs WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.action) {
      query += ` AND action = $${paramIndex}`;
      countQuery += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters?.operatorId) {
      query += ` AND operator_id = $${paramIndex}`;
      countQuery += ` AND operator_id = $${paramIndex}`;
      params.push(filters.operatorId);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      countQuery += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      countQuery += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, (page - 1) * pageSize);

    const [logsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, paramIndex - 1))
    ]);

    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }
}
