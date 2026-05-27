import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database';
import { MaterialStatus } from '../types';

export async function logAudit(
  db: Database,
  entityType: 'material' | 'batch' | 'deduction',
  entityId: string,
  action: string,
  operator: string,
  reason: string,
  fieldName?: string,
  oldValue?: string,
  newValue?: string
) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, field_name, old_value, new_value, operator, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, entityType, entityId, action, fieldName || null, oldValue || null, newValue || null, operator, reason, now
  );

  return id;
}

export async function createProcessingRecord(
  db: Database,
  materialId: string,
  previousStatus: MaterialStatus,
  newStatus: MaterialStatus,
  previousReason: string,
  newReason: string,
  changedBy: string,
  changeReason: string,
  previousDeduction?: number,
  newDeduction?: number
) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO processing_records (
      id, material_id, previous_status, new_status, previous_reason, new_reason,
      previous_deduction, new_deduction, changed_by, change_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, materialId, previousStatus, newStatus, previousReason, newReason,
    previousDeduction || null, newDeduction || null, changedBy, changeReason, now
  );

  await logAudit(
    db, 'material', materialId, 'reclassify', changedBy, changeReason,
    'status', previousStatus, newStatus
  );

  return id;
}

export async function getMaterialTrail(db: Database, materialId: string) {
  const material = await db.get(
    'SELECT * FROM materials WHERE id = ?',
    materialId
  );

  if (!material) {
    return null;
  }

  const processingRecords = await db.all(
    `SELECT * FROM processing_records 
     WHERE material_id = ? 
     ORDER BY created_at DESC`,
    materialId
  );

  const auditLogs = await db.all(
    `SELECT * FROM audit_logs 
     WHERE entity_type = 'material' AND entity_id = ?
     ORDER BY created_at DESC`,
    materialId
  );

  const deductions = await db.all(
    `SELECT * FROM deduction_records 
     WHERE material_id = ?
     ORDER BY created_at DESC`,
    materialId
  );

  return {
    material,
    processingRecords,
    auditLogs,
    deductions,
    changeHistory: processingRecords.map((r: any) => ({
      changedAt: r.created_at,
      changedBy: r.changed_by,
      changeReason: r.change_reason,
      previous: {
        status: r.previous_status,
        reason: r.previous_reason,
        deduction: r.previous_deduction
      },
      new: {
        status: r.new_status,
        reason: r.new_reason,
        deduction: r.new_deduction
      }
    }))
  };
}

export async function getAuditLogs(
  db: Database,
  entityType?: string,
  entityId?: string,
  operator?: string,
  limit: number = 100
) {
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params: any[] = [];

  if (entityType) {
    query += ` AND entity_type = ?`;
    params.push(entityType);
  }

  if (entityId) {
    query += ` AND entity_id = ?`;
    params.push(entityId);
  }

  if (operator) {
    query += ` AND operator = ?`;
    params.push(operator);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  return db.all(query, ...params);
}
