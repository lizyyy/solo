import db from '../config/database';
import { PumpRoom } from '../types';

export class PumpRoomModel {
  static create(data: Omit<PumpRoom, 'id' | 'created_at' | 'updated_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO pump_room (name, location, building, equipment_count, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name,
      data.location,
      data.building || null,
      data.equipment_count,
      data.status
    );
    return Number(result.lastInsertRowid);
  }

  static getById(id: number): PumpRoom | undefined {
    const stmt = db.prepare('SELECT * FROM pump_room WHERE id = ?');
    return stmt.get(id) as PumpRoom | undefined;
  }

  static getAll(): PumpRoom[] {
    const stmt = db.prepare('SELECT * FROM pump_room ORDER BY name');
    return stmt.all() as PumpRoom[];
  }

  static updateStatus(id: number, status: string): void {
    const stmt = db.prepare(`
      UPDATE pump_room
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, id);
  }
}
