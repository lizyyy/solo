import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface Shift {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime: string;
  notes?: string;
  createdAt: string;
}

export class ShiftDAO {
  static getAll(): Shift[] {
    const stmt = db.prepare(`
      SELECT 
        id, vehicle_id as vehicleId, driver_id as driverId,
        start_time as startTime, end_time as endTime, notes,
        created_at as createdAt
      FROM shifts
      ORDER BY start_time DESC
    `);
    return stmt.all() as Shift[];
  }

  static getById(id: string): Shift | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, vehicle_id as vehicleId, driver_id as driverId,
        start_time as startTime, end_time as endTime, notes,
        created_at as createdAt
      FROM shifts WHERE id = ?
    `);
    return stmt.get(id) as Shift | undefined;
  }

  static getByVehicleId(vehicleId: string): Shift[] {
    const stmt = db.prepare(`
      SELECT 
        id, vehicle_id as vehicleId, driver_id as driverId,
        start_time as startTime, end_time as endTime, notes,
        created_at as createdAt
      FROM shifts WHERE vehicle_id = ?
      ORDER BY start_time DESC
    `);
    return stmt.all(vehicleId) as Shift[];
  }

  static findMatchingShifts(vehicleId: string, violationTime: string): Shift[] {
    const stmt = db.prepare(`
      SELECT 
        id, vehicle_id as vehicleId, driver_id as driverId,
        start_time as startTime, end_time as endTime, notes,
        created_at as createdAt
      FROM shifts 
      WHERE vehicle_id = ? AND ? BETWEEN start_time AND end_time
      ORDER BY start_time DESC
    `);
    return stmt.all(vehicleId, violationTime) as Shift[];
  }

  static create(data: Omit<Shift, 'id' | 'createdAt'>): Shift {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO shifts (id, vehicle_id, driver_id, start_time, end_time, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.vehicleId, data.driverId, data.startTime, data.endTime, data.notes || null, now);
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<Omit<Shift, 'id' | 'createdAt'>>): Shift | null {
    const shift = this.getById(id);
    if (!shift) return null;

    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.vehicleId !== undefined) { updates.push('vehicle_id = ?'); values.push(data.vehicleId); }
    if (data.driverId !== undefined) { updates.push('driver_id = ?'); values.push(data.driverId); }
    if (data.startTime !== undefined) { updates.push('start_time = ?'); values.push(data.startTime); }
    if (data.endTime !== undefined) { updates.push('end_time = ?'); values.push(data.endTime); }
    if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes); }

    if (updates.length === 0) return shift;

    const stmt = db.prepare(`UPDATE shifts SET ${updates.join(', ')} WHERE id = ?`);
    values.push(id);
    stmt.run(...values);
    
    return this.getById(id) || null;
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM shifts WHERE id = ?');
    const result = stmt.run(id);
    return (result.changes || 0) > 0;
  }
}

export default ShiftDAO;
