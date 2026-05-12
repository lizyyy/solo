import { db } from '../database';
import { ShiftInspection, InspectionItemResult, InspectionStatus } from '../models';

export class InspectionRepository {
  async create(data: Omit<ShiftInspection, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShiftInspection> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO shift_inspection 
       (id, idempotent_key, equipment_id, template_id, shift, shift_date, inspector_id, 
        inspector_name, status, start_time, end_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.idempotentKey, data.equipmentId, data.templateId, data.shift, data.shiftDate,
       data.inspectorId, data.inspectorName, data.status || InspectionStatus.DRAFT,
       data.startTime, data.endTime, now, now]
    );
    return this.findById(id) as Promise<ShiftInspection>;
  }

  async findById(id: string): Promise<ShiftInspection | undefined> {
    return db.get<ShiftInspection>(
      `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
              template_id as templateId, shift, shift_date as shiftDate,
              inspector_id as inspectorId, inspector_name as inspectorName,
              status, start_time as startTime, end_time as endTime,
              created_at as createdAt, updated_at as updatedAt
       FROM shift_inspection WHERE id = ?`,
      [id]
    );
  }

  async findByIdempotentKey(key: string): Promise<ShiftInspection | undefined> {
    return db.get<ShiftInspection>(
      `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
              template_id as templateId, shift, shift_date as shiftDate,
              inspector_id as inspectorId, inspector_name as inspectorName,
              status, start_time as startTime, end_time as endTime,
              created_at as createdAt, updated_at as updatedAt
       FROM shift_inspection WHERE idempotent_key = ?`,
      [key]
    );
  }

  async findByEquipmentShiftDate(equipmentId: string, shiftDate: string, shift: string): Promise<ShiftInspection | undefined> {
    return db.get<ShiftInspection>(
      `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
              template_id as templateId, shift, shift_date as shiftDate,
              inspector_id as inspectorId, inspector_name as inspectorName,
              status, start_time as startTime, end_time as endTime,
              created_at as createdAt, updated_at as updatedAt
       FROM shift_inspection WHERE equipment_id = ? AND shift_date = ? AND shift = ?`,
      [equipmentId, shiftDate, shift]
    );
  }

  async findAll(filters?: { equipmentId?: string; shiftDate?: string; status?: string }): Promise<ShiftInspection[]> {
    let sql = `SELECT id, idempotent_key as idempotentKey, equipment_id as equipmentId,
                      template_id as templateId, shift, shift_date as shiftDate,
                      inspector_id as inspectorId, inspector_name as inspectorName,
                      status, start_time as startTime, end_time as endTime,
                      created_at as createdAt, updated_at as updatedAt
               FROM shift_inspection WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.equipmentId) {
      sql += ' AND equipment_id = ?';
      params.push(filters.equipmentId);
    }
    if (filters?.shiftDate) {
      sql += ' AND shift_date = ?';
      params.push(filters.shiftDate);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY created_at DESC';
    
    return db.all<ShiftInspection>(sql, params);
  }

  async update(id: string, data: Partial<ShiftInspection>): Promise<void> {
    const now = db.now();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];
    
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.startTime !== undefined) { updates.push('start_time = ?'); params.push(data.startTime); }
    if (data.endTime !== undefined) { updates.push('end_time = ?'); params.push(data.endTime); }
    
    params.push(id);
    
    await db.run(`UPDATE shift_inspection SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async createItemResult(data: Omit<InspectionItemResult, 'id'>): Promise<InspectionItemResult> {
    const id = db.generateId();
    await db.run(
      `INSERT INTO inspection_item_result
       (id, inspection_id, item_id, item_name, item_type, standard, 
        actual_value, is_normal, remark, checked_at, checked_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.inspectionId, data.itemId, data.itemName, data.itemType, data.standard,
       data.actualValue, data.isNormal ? 1 : 0, data.remark, data.checkedAt, data.checkedBy]
    );
    return this.findItemResultById(id) as Promise<InspectionItemResult>;
  }

  async findItemResultById(id: string): Promise<InspectionItemResult | undefined> {
    return db.get<InspectionItemResult>(
      `SELECT id, inspection_id as inspectionId, item_id as itemId,
              item_name as itemName, item_type as itemType, standard,
              actual_value as actualValue, is_normal as isNormal, remark,
              checked_at as checkedAt, checked_by as checkedBy
       FROM inspection_item_result WHERE id = ?`,
      [id]
    );
  }

  async findItemResultsByInspection(inspectionId: string): Promise<InspectionItemResult[]> {
    return db.all<InspectionItemResult>(
      `SELECT id, inspection_id as inspectionId, item_id as itemId,
              item_name as itemName, item_type as itemType, standard,
              actual_value as actualValue, is_normal as isNormal, remark,
              checked_at as checkedAt, checked_by as checkedBy
       FROM inspection_item_result WHERE inspection_id = ? ORDER BY checked_at ASC`,
      [inspectionId]
    );
  }
}

export const inspectionRepository = new InspectionRepository();
