import { getAll, getOne, runQuery } from '../database/connection';
import { Defect, DefectStatus, DefectType, DefectPhoto, RectificationRequirement, ReinspectionRecord } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class DefectDAO {
  async create(defectData: Omit<Defect, 'id' | 'registeredAt' | 'updatedAt' | 'reinspections' | 'photos' | 'rectification'>): Promise<Defect> {
    const id = uuidv4();
    const now = new Date();
    const nowStr = now.toISOString();

    await runQuery(
      `INSERT INTO defects (id, procurement_order_no, equipment_no, defect_type, description, status, inspector, registered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, defectData.procurementOrderNo, defectData.equipmentNo, defectData.defectType, defectData.description, defectData.status, defectData.inspector, nowStr, nowStr]
    );

    return this.getById(id) as Promise<Defect>;
  }

  async getById(id: string): Promise<Defect | null> {
    const defectRow = await getOne<any>(
      'SELECT * FROM defects WHERE id = ?',
      [id]
    );

    if (!defectRow) return null;

    return this.mapRowToDefect(defectRow);
  }

  async getAll(filters?: { procurementOrderNo?: string; equipmentNo?: string; status?: DefectStatus }): Promise<Defect[]> {
    let sql = 'SELECT * FROM defects WHERE 1=1';
    const params: any[] = [];

    if (filters?.procurementOrderNo) {
      sql += ' AND procurement_order_no = ?';
      params.push(filters.procurementOrderNo);
    }

    if (filters?.equipmentNo) {
      sql += ' AND equipment_no = ?';
      params.push(filters.equipmentNo);
    }

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY registered_at DESC';

    const rows = await getAll<any>(sql, params);
    return Promise.all(rows.map(row => this.mapRowToDefect(row)));
  }

  async updateStatus(id: string, status: DefectStatus): Promise<void> {
    const nowStr = new Date().toISOString();
    await runQuery(
      'UPDATE defects SET status = ?, updated_at = ? WHERE id = ?',
      [status, nowStr, id]
    );
  }

  async addPhoto(defectId: string, photo: Omit<DefectPhoto, 'id'>): Promise<DefectPhoto> {
    const id = uuidv4();
    const nowStr = photo.uploadedAt.toISOString();

    await runQuery(
      `INSERT INTO defect_photos (id, defect_id, url, filename, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, defectId, photo.url, photo.filename, nowStr, photo.uploadedBy]
    );

    return { ...photo, id };
  }

  async setRectification(defectId: string, rectification: Omit<RectificationRequirement, 'id' | 'defectId' | 'createdAt' | 'updatedAt'>): Promise<RectificationRequirement> {
    const id = uuidv4();
    const nowStr = new Date().toISOString();
    const deadlineStr = rectification.deadline.toISOString();

    await runQuery(
      `INSERT OR REPLACE INTO rectification_requirements (id, defect_id, content, deadline, responsible_person, created_at, updated_at)
       VALUES (COALESCE((SELECT id FROM rectification_requirements WHERE defect_id = ?), ?), ?, ?, ?, ?, ?)`,
      [defectId, id, defectId, rectification.content, deadlineStr, rectification.responsiblePerson, nowStr, nowStr]
    );

    return {
      id,
      defectId,
      ...rectification,
      createdAt: new Date(nowStr),
      updatedAt: new Date(nowStr)
    };
  }

  async addReinspection(defectId: string, reinspection: Omit<ReinspectionRecord, 'id' | 'defectId' | 'createdAt'>): Promise<ReinspectionRecord> {
    const id = uuidv4();
    const nowStr = new Date().toISOString();
    const inspectionDateStr = reinspection.inspectionDate.toISOString();

    await runQuery(
      `INSERT INTO reinspection_records (id, defect_id, inspector, inspection_date, result, remarks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, defectId, reinspection.inspector, inspectionDateStr, reinspection.result, reinspection.remarks, nowStr]
    );

    return {
      id,
      defectId,
      ...reinspection,
      createdAt: new Date(nowStr)
    };
  }

  async addManualCorrection(defectId: string, correction: { field: string; oldValue: any; newValue: any; reason: string; operator: string }): Promise<void> {
    const id = uuidv4();
    const nowStr = new Date().toISOString();

    await runQuery(
      `INSERT INTO manual_corrections (id, defect_id, field, old_value, new_value, reason, operator, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, defectId, correction.field, JSON.stringify(correction.oldValue), JSON.stringify(correction.newValue), correction.reason, correction.operator, nowStr]
    );
  }

  private async mapRowToDefect(row: any): Promise<Defect> {
    const photos = await getAll<any>(
      'SELECT * FROM defect_photos WHERE defect_id = ? ORDER BY uploaded_at ASC',
      [row.id]
    );

    const rectification = await getOne<any>(
      'SELECT * FROM rectification_requirements WHERE defect_id = ?',
      [row.id]
    );

    const reinspections = await getAll<any>(
      'SELECT * FROM reinspection_records WHERE defect_id = ? ORDER BY created_at DESC',
      [row.id]
    );

    const isOverdue = rectification && new Date(rectification.deadline) < new Date();

    return {
      id: row.id,
      procurementOrderNo: row.procurement_order_no,
      equipmentNo: row.equipment_no,
      defectType: row.defect_type as DefectType,
      description: row.description,
      status: row.status as DefectStatus,
      inspector: row.inspector,
      registeredAt: new Date(row.registered_at),
      updatedAt: new Date(row.updated_at),
      photos: photos.map(p => ({
        id: p.id,
        url: p.url,
        filename: p.filename,
        uploadedAt: new Date(p.uploaded_at),
        uploadedBy: p.uploaded_by
      })),
      rectification: rectification ? {
        id: rectification.id,
        defectId: rectification.defect_id,
        content: rectification.content,
        deadline: new Date(rectification.deadline),
        responsiblePerson: rectification.responsible_person,
        createdAt: new Date(rectification.created_at),
        updatedAt: new Date(rectification.updated_at)
      } : undefined,
      reinspections: reinspections.map(r => ({
        id: r.id,
        defectId: r.defect_id,
        inspector: r.inspector,
        inspectionDate: new Date(r.inspection_date),
        result: r.result,
        remarks: r.remarks,
        createdAt: new Date(r.created_at)
      })),
      isOverdue
    };
  }
}
