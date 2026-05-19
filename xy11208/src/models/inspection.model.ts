import db from '../config/database';
import { InspectionRecord, QueryFilters } from '../types';

export class InspectionModel {
  static create(data: Omit<InspectionRecord, 'id' | 'created_at' | 'updated_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO inspection_record (
        pump_room_id, inspector_id, inspection_date, status,
        water_pressure, water_equipment_status, has_leakage,
        noise_level, remarks, exception_type, is_needs_repair
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.pump_room_id,
      data.inspector_id,
      data.inspection_date,
      data.status,
      data.water_pressure || null,
      data.water_equipment_status || null,
      data.has_leakage ? 1 : 0,
      data.noise_level || null,
      data.remarks || null,
      data.exception_type || null,
      data.is_needs_repair ? 1 : 0
    );
    return Number(result.lastInsertRowid);
  }

  static getById(id: number): InspectionRecord | undefined {
    const stmt = db.prepare('SELECT * FROM inspection_record WHERE id = ?');
    return stmt.get(id) as InspectionRecord | undefined;
  }

  static getAll(filters: QueryFilters = {}): InspectionRecord[] {
    let query = `
      SELECT ir.*, pr.name as inspector_name, prm.name as pump_room_name
      FROM inspection_record ir
      LEFT JOIN person_in_charge pr ON ir.inspector_id = pr.id
      LEFT JOIN pump_room prm ON ir.pump_room_id = prm.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.inspectorId) {
      query += ' AND ir.inspector_id = ?';
      params.push(filters.inspectorId);
    }
    if (filters.startDate) {
      query += ' AND ir.inspection_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND ir.inspection_date <= ?';
      params.push(filters.endDate);
    }
    if (filters.status) {
      query += ' AND ir.status = ?';
      params.push(filters.status);
    }
    if (filters.exceptionType) {
      query += ' AND ir.exception_type = ?';
      params.push(filters.exceptionType);
    }
    if (filters.pumpRoomId) {
      query += ' AND ir.pump_room_id = ?';
      params.push(filters.pumpRoomId);
    }

    query += ' ORDER BY ir.inspection_date DESC, ir.created_at DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params) as InspectionRecord[];
  }

  static updateStatus(id: number, status: string): void {
    const stmt = db.prepare(`
      UPDATE inspection_record
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, id);
  }

  static getActiveByPumpRoom(pumpRoomId: number): InspectionRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM inspection_record
      WHERE pump_room_id = ? AND status IN ('待处理', '已报修')
      ORDER BY created_at DESC
    `);
    return stmt.all(pumpRoomId) as InspectionRecord[];
  }

  static hasRecentInspection(pumpRoomId: number, hours: number = 24): boolean {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM inspection_record
      WHERE pump_room_id = ?
      AND inspection_date >= datetime('now', '-' || ? || ' hours')
    `);
    const result = stmt.get(pumpRoomId, hours) as { count: number };
    return result.count > 0;
  }
}
