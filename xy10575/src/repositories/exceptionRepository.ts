import { db } from '../database';
import { ExceptionRecord, ExceptionStatus, DowntimeRecord, DowntimeStatus, MaintenanceAssignment, MaintenanceStatus, RecheckRecord, RecheckStatus } from '../models';

export class ExceptionRepository {
  async createException(data: Omit<ExceptionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExceptionRecord> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO exception_record
       (id, idempotent_key, inspection_id, item_result_id, equipment_id, 
        item_id, item_name, item_type, description, level, reporter_id, 
        reporter_name, status, detected_at, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.idempotentKey, data.inspectionId, data.itemResultId, data.equipmentId,
       data.itemId, data.itemName, data.itemType, data.description, data.level,
       data.reporterId, data.reporterName, data.status || ExceptionStatus.DETECTED,
       data.detectedAt, data.resolvedAt, now, now]
    );
    return this.findExceptionById(id) as Promise<ExceptionRecord>;
  }

  async findExceptionById(id: string): Promise<ExceptionRecord | undefined> {
    return db.get<ExceptionRecord>(
      `SELECT id, idempotent_key as idempotentKey, inspection_id as inspectionId,
              item_result_id as itemResultId, equipment_id as equipmentId,
              item_id as itemId, item_name as itemName, item_type as itemType,
              description, level, reporter_id as reporterId, reporter_name as reporterName,
              status, detected_at as detectedAt, resolved_at as resolvedAt,
              created_at as createdAt, updated_at as updatedAt
       FROM exception_record WHERE id = ?`,
      [id]
    );
  }

  async findExceptionByIdempotentKey(key: string): Promise<ExceptionRecord | undefined> {
    return db.get<ExceptionRecord>(
      `SELECT id, idempotent_key as idempotentKey, inspection_id as inspectionId,
              item_result_id as itemResultId, equipment_id as equipmentId,
              item_id as itemId, item_name as itemName, item_type as itemType,
              description, level, reporter_id as reporterId, reporter_name as reporterName,
              status, detected_at as detectedAt, resolved_at as resolvedAt,
              created_at as createdAt, updated_at as updatedAt
       FROM exception_record WHERE idempotent_key = ?`,
      [key]
    );
  }

  async findAllExceptions(filters?: { equipmentId?: string; status?: string; inspectionId?: string }): Promise<ExceptionRecord[]> {
    let sql = `SELECT id, idempotent_key as idempotentKey, inspection_id as inspectionId,
                      item_result_id as itemResultId, equipment_id as equipmentId,
                      item_id as itemId, item_name as itemName, item_type as itemType,
                      description, level, reporter_id as reporterId, reporter_name as reporterName,
                      status, detected_at as detectedAt, resolved_at as resolvedAt,
                      created_at as createdAt, updated_at as updatedAt
               FROM exception_record WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.equipmentId) { sql += ' AND equipment_id = ?'; params.push(filters.equipmentId); }
    if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters?.inspectionId) { sql += ' AND inspection_id = ?'; params.push(filters.inspectionId); }
    sql += ' ORDER BY detected_at DESC';
    
    return db.all<ExceptionRecord>(sql, params);
  }

  async updateException(id: string, data: Partial<ExceptionRecord>): Promise<void> {
    const now = db.now();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];
    
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.resolvedAt !== undefined) { updates.push('resolved_at = ?'); params.push(data.resolvedAt); }
    
    params.push(id);
    await db.run(`UPDATE exception_record SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async createDowntime(data: Omit<DowntimeRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<DowntimeRecord> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO downtime_record
       (id, idempotent_key, equipment_id, exception_id, inspection_id, reason,
        start_time, end_time, duration_minutes, operator_id, operator_name, status,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.idempotentKey, data.equipmentId, data.exceptionId, data.inspectionId,
       data.reason, data.startTime, data.endTime, data.durationMinutes,
       data.operatorId, data.operatorName, data.status || DowntimeStatus.SCHEDULED, now, now]
    );
    return this.findDowntimeById(id) as Promise<DowntimeRecord>;
  }

  async findDowntimeById(id: string): Promise<DowntimeRecord | undefined> {
    return db.get<DowntimeRecord>(
      `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
              exception_id as exceptionId, inspection_id as inspectionId, reason,
              start_time as startTime, end_time as endTime, duration_minutes as durationMinutes,
              operator_id as operatorId, operator_name as operatorName, status,
              created_at as createdAt, updated_at as updatedAt
       FROM downtime_record WHERE id = ?`,
      [id]
    );
  }

  async findDowntimeByIdempotentKey(key: string): Promise<DowntimeRecord | undefined> {
    return db.get<DowntimeRecord>(
      `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
              exception_id as exceptionId, inspection_id as inspectionId, reason,
              start_time as startTime, end_time as endTime, duration_minutes as durationMinutes,
              operator_id as operatorId, operator_name as operatorName, status,
              created_at as createdAt, updated_at as updatedAt
       FROM downtime_record WHERE idempotent_key = ?`,
      [key]
    );
  }

  async findAllDowntime(filters?: { equipmentId?: string; status?: string; exceptionId?: string }): Promise<DowntimeRecord[]> {
    let sql = `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
                      exception_id as exceptionId, inspection_id as inspectionId, reason,
                      start_time as startTime, end_time as endTime, duration_minutes as durationMinutes,
                      operator_id as operatorId, operator_name as operatorName, status,
                      created_at as createdAt, updated_at as updatedAt
               FROM downtime_record WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.equipmentId) { sql += ' AND equipment_id = ?'; params.push(filters.equipmentId); }
    if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters?.exceptionId) { sql += ' AND exception_id = ?'; params.push(filters.exceptionId); }
    sql += ' ORDER BY start_time DESC';
    
    return db.all<DowntimeRecord>(sql, params);
  }

  async updateDowntime(id: string, data: Partial<DowntimeRecord>): Promise<void> {
    const now = db.now();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];
    
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.startTime !== undefined) { updates.push('start_time = ?'); params.push(data.startTime); }
    if (data.endTime !== undefined) { updates.push('end_time = ?'); params.push(data.endTime); }
    if (data.durationMinutes !== undefined) { updates.push('duration_minutes = ?'); params.push(data.durationMinutes); }
    
    params.push(id);
    await db.run(`UPDATE downtime_record SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async createMaintenance(data: Omit<MaintenanceAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<MaintenanceAssignment> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO maintenance_assignment
       (id, idempotent_key, exception_id, equipment_id, assignee_id, assignee_name,
        priority, description, status, assigned_at, started_at, completed_at, result,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.idempotentKey, data.exceptionId, data.equipmentId, data.assigneeId,
       data.assigneeName, data.priority, data.description, data.status || MaintenanceStatus.ASSIGNED,
       data.assignedAt, data.startedAt, data.completedAt, data.result, now, now]
    );
    return this.findMaintenanceById(id) as Promise<MaintenanceAssignment>;
  }

  async findMaintenanceById(id: string): Promise<MaintenanceAssignment | undefined> {
    return db.get<MaintenanceAssignment>(
      `SELECT id, idempotent_key as idempotentKey, exception_id as exceptionId,
              equipment_id as equipmentId, assignee_id as assigneeId, assignee_name as assigneeName,
              priority, description, status, assigned_at as assignedAt,
              started_at as startedAt, completed_at as completedAt, result,
              created_at as createdAt, updated_at as updatedAt
       FROM maintenance_assignment WHERE id = ?`,
      [id]
    );
  }

  async findMaintenanceByIdempotentKey(key: string): Promise<MaintenanceAssignment | undefined> {
    return db.get<MaintenanceAssignment>(
      `SELECT id, idempotent_key as idempotentKey, exception_id as exceptionId,
              equipment_id as equipmentId, assignee_id as assigneeId, assignee_name as assigneeName,
              priority, description, status, assigned_at as assignedAt,
              started_at as startedAt, completed_at as completedAt, result,
              created_at as createdAt, updated_at as updatedAt
       FROM maintenance_assignment WHERE idempotent_key = ?`,
      [key]
    );
  }

  async findMaintenanceByException(exceptionId: string): Promise<MaintenanceAssignment[]> {
    return db.all<MaintenanceAssignment>(
      `SELECT id, idempotent_key as idempotentKey, exception_id as exceptionId,
              equipment_id as equipmentId, assignee_id as assigneeId, assignee_name as assigneeName,
              priority, description, status, assigned_at as assignedAt,
              started_at as startedAt, completed_at as completedAt, result,
              created_at as createdAt, updated_at as updatedAt
       FROM maintenance_assignment WHERE exception_id = ? ORDER BY assigned_at DESC`,
      [exceptionId]
    );
  }

  async updateMaintenance(id: string, data: Partial<MaintenanceAssignment>): Promise<void> {
    const now = db.now();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];
    
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.startedAt !== undefined) { updates.push('started_at = ?'); params.push(data.startedAt); }
    if (data.completedAt !== undefined) { updates.push('completed_at = ?'); params.push(data.completedAt); }
    if (data.result !== undefined) { updates.push('result = ?'); params.push(data.result); }
    
    params.push(id);
    await db.run(`UPDATE maintenance_assignment SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async createRecheck(data: Omit<RecheckRecord, 'id' | 'createdAt'>): Promise<RecheckRecord> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO recheck_record
       (id, idempotent_key, exception_id, inspection_id, maintenance_id, equipment_id,
        rechecker_id, rechecker_name, result, remark, rechecked_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.idempotentKey, data.exceptionId, data.inspectionId, data.maintenanceId,
       data.equipmentId, data.recheckerId, data.recheckerName, data.result,
       data.remark, data.recheckedAt, now]
    );
    return this.findRecheckById(id) as Promise<RecheckRecord>;
  }

  async findRecheckById(id: string): Promise<RecheckRecord | undefined> {
    return db.get<RecheckRecord>(
      `SELECT id, idempotent_key as idempotentKey, exception_id as exceptionId,
              inspection_id as inspectionId, maintenance_id as maintenanceId,
              equipment_id as equipmentId, rechecker_id as recheckerId,
              rechecker_name as recheckerName, result, remark, rechecked_at as recheckedAt,
              created_at as createdAt
       FROM recheck_record WHERE id = ?`,
      [id]
    );
  }

  async findRecheckByIdempotentKey(key: string): Promise<RecheckRecord | undefined> {
    return db.get<RecheckRecord>(
      `SELECT id, idempotent_key as idempotentKey, exception_id as exceptionId,
              inspection_id as inspectionId, maintenance_id as maintenanceId,
              equipment_id as equipmentId, rechecker_id as recheckerId,
              rechecker_name as recheckerName, result, remark, rechecked_at as recheckedAt,
              created_at as createdAt
       FROM recheck_record WHERE idempotent_key = ?`,
      [key]
    );
  }

  async findRechecksByException(exceptionId: string): Promise<RecheckRecord[]> {
    return db.all<RecheckRecord>(
      `SELECT id, idempotent_key as idempotentKey, exception_id as exceptionId,
              inspection_id as inspectionId, maintenance_id as maintenanceId,
              equipment_id as equipmentId, rechecker_id as recheckerId,
              rechecker_name as recheckerName, result, remark, rechecked_at as recheckedAt,
              created_at as createdAt
       FROM recheck_record WHERE exception_id = ? ORDER BY rechecked_at DESC`,
      [exceptionId]
    );
  }
}

export const exceptionRepository = new ExceptionRepository();
