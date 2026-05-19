import db from '../config/database';
import { RepairRecord, QueryFilters } from '../types';

export class RepairModel {
  static create(data: Omit<RepairRecord, 'id' | 'created_at' | 'updated_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO repair_record (
        inspection_id, pump_room_id, reporter_id, handler_id,
        problem_description, status, priority, due_date,
        escalated, escalated_at, resolved_at, resolution,
        retest_failed, retest_remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.inspection_id,
      data.pump_room_id,
      data.reporter_id,
      data.handler_id || null,
      data.problem_description,
      data.status,
      data.priority,
      data.due_date || null,
      data.escalated ? 1 : 0,
      data.escalated_at || null,
      data.resolved_at || null,
      data.resolution || null,
      data.retest_failed ? 1 : 0,
      data.retest_remark || null
    );
    return Number(result.lastInsertRowid);
  }

  static getById(id: number): RepairRecord | undefined {
    const stmt = db.prepare('SELECT * FROM repair_record WHERE id = ?');
    return stmt.get(id) as RepairRecord | undefined;
  }

  static getAll(filters: QueryFilters = {}): (RepairRecord & { reporter_name?: string; handler_name?: string; pump_room_name?: string })[] {
    let query = `
      SELECT rr.*,
             rpr.name as reporter_name,
             hdl.name as handler_name,
             prm.name as pump_room_name
      FROM repair_record rr
      LEFT JOIN person_in_charge rpr ON rr.reporter_id = rpr.id
      LEFT JOIN person_in_charge hdl ON rr.handler_id = hdl.id
      LEFT JOIN pump_room prm ON rr.pump_room_id = prm.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.handlerId) {
      query += ' AND rr.handler_id = ?';
      params.push(filters.handlerId);
    }
    if (filters.startDate) {
      query += ' AND rr.created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND rr.created_at <= ?';
      params.push(filters.endDate);
    }
    if (filters.status) {
      query += ' AND rr.status = ?';
      params.push(filters.status);
    }
    if (filters.pumpRoomId) {
      query += ' AND rr.pump_room_id = ?';
      params.push(filters.pumpRoomId);
    }

    query += ' ORDER BY rr.created_at DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params) as any[];
  }

  static update(id: number, data: Partial<RepairRecord>): void {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.handler_id !== undefined) { updates.push('handler_id = ?'); params.push(data.handler_id); }
    if (data.priority !== undefined) { updates.push('priority = ?'); params.push(data.priority); }
    if (data.due_date !== undefined) { updates.push('due_date = ?'); params.push(data.due_date); }
    if (data.escalated !== undefined) { updates.push('escalated = ?'); params.push(data.escalated ? 1 : 0); }
    if (data.escalated_at !== undefined) { updates.push('escalated_at = ?'); params.push(data.escalated_at); }
    if (data.resolved_at !== undefined) { updates.push('resolved_at = ?'); params.push(data.resolved_at); }
    if (data.resolution !== undefined) { updates.push('resolution = ?'); params.push(data.resolution); }
    if (data.retest_failed !== undefined) { updates.push('retest_failed = ?'); params.push(data.retest_failed ? 1 : 0); }
    if (data.retest_remark !== undefined) { updates.push('retest_remark = ?'); params.push(data.retest_remark); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const stmt = db.prepare(`
      UPDATE repair_record
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...params);
  }

  static getActiveByPumpRoom(pumpRoomId: number): RepairRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM repair_record
      WHERE pump_room_id = ? AND status IN ('待派单', '处理中', '待复测')
      ORDER BY created_at DESC
    `);
    return stmt.all(pumpRoomId) as RepairRecord[];
  }

  static getOverdue(): RepairRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM repair_record
      WHERE status IN ('待派单', '处理中')
        AND due_date IS NOT NULL
        AND due_date < datetime('now')
        AND escalated = 0
      ORDER BY due_date ASC
    `);
    return stmt.all() as RepairRecord[];
  }

  static hasOpenRepair(pumpRoomId: number, problemDesc: string): boolean {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM repair_record
      WHERE pump_room_id = ?
        AND status IN ('待派单', '处理中', '待复测')
        AND problem_description LIKE ?
    `);
    const result = stmt.get(pumpRoomId, `%${problemDesc}%`) as { count: number };
    return result.count > 0;
  }
}
