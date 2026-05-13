import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { OperationLog } from '../types';

export class OperationLogService {
  static async createLog(
    operationType: string,
    entityType: string,
    entityId: string,
    operatorId: string,
    operatorName: string,
    beforeValue?: any,
    afterValue?: any,
    remarks?: string
  ): Promise<OperationLog> {
    const log: OperationLog = {
      id: uuidv4(),
      operationType,
      entityType,
      entityId,
      operatorId,
      operatorName,
      operateTime: new Date().toISOString(),
      beforeValue,
      afterValue,
      remarks
    };

    await db.run(
      `INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, operator_id, operator_name, operate_time, before_value, after_value, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.operationType,
        log.entityType,
        log.entityId,
        log.operatorId,
        log.operatorName,
        log.operateTime,
        beforeValue ? JSON.stringify(beforeValue) : null,
        afterValue ? JSON.stringify(afterValue) : null,
        remarks
      ]
    );

    return log;
  }

  static async getLogsByEntity(entityType: string, entityId: string): Promise<OperationLog[]> {
    const rows = await db.all<any>(
      `SELECT * FROM operation_logs WHERE entity_type = ? AND entity_id = ? ORDER BY operate_time DESC`,
      [entityType, entityId]
    );
    return rows.map(row => this.mapRowToLog(row));
  }

  static async getAllLogs(limit: number = 100): Promise<OperationLog[]> {
    const rows = await db.all<any>(
      `SELECT * FROM operation_logs ORDER BY operate_time DESC LIMIT ?`,
      [limit]
    );
    return rows.map(row => this.mapRowToLog(row));
  }

  static async getLogsByOperator(operatorId: string): Promise<OperationLog[]> {
    const rows = await db.all<any>(
      `SELECT * FROM operation_logs WHERE operator_id = ? ORDER BY operate_time DESC`,
      [operatorId]
    );
    return rows.map(row => this.mapRowToLog(row));
  }

  static async getLogsByTimeRange(startTime: string, endTime: string): Promise<OperationLog[]> {
    const rows = await db.all<any>(
      `SELECT * FROM operation_logs WHERE operate_time >= ? AND operate_time <= ? ORDER BY operate_time DESC`,
      [startTime, endTime]
    );
    return rows.map(row => this.mapRowToLog(row));
  }

  private static mapRowToLog(row: any): OperationLog {
    return {
      id: row.id,
      operationType: row.operation_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      operateTime: row.operate_time,
      beforeValue: row.before_value ? JSON.parse(row.before_value) : undefined,
      afterValue: row.after_value ? JSON.parse(row.after_value) : undefined,
      remarks: row.remarks
    };
  }
}
