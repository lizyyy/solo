import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { Shift } from '../types';

export class ShiftRepository {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async create(shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>): Promise<Shift> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO shifts (
        id, driver_id, vehicle_id, shift_date,
        start_time, end_time, route, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await Database.run(this.db, sql, [
      id, shift.driverId, shift.vehicleId, shift.shiftDate,
      shift.startTime, shift.endTime, shift.route, shift.status, now, now
    ]);

    return this.findById(id) as Promise<Shift>;
  }

  async findById(id: string): Promise<Shift | undefined> {
    const sql = `
      SELECT 
        id, driver_id as driverId,
        vehicle_id as vehicleId,
        shift_date as shiftDate,
        start_time as startTime,
        end_time as endTime,
        route, status,
        created_at as createdAt, updated_at as updatedAt
      FROM shifts WHERE id = ?
    `;
    return Database.get<Shift>(this.db, sql, [id]);
  }

  async findAll(filters?: {
    driverId?: string;
    shiftDate?: string;
    status?: string;
  }): Promise<Shift[]> {
    let sql = `
      SELECT 
        id, driver_id as driverId,
        vehicle_id as vehicleId,
        shift_date as shiftDate,
        start_time as startTime,
        end_time as endTime,
        route, status,
        created_at as createdAt, updated_at as updatedAt
      FROM shifts
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.driverId) {
      sql += ` AND driver_id = ?`;
      params.push(filters.driverId);
    }
    if (filters?.shiftDate) {
      sql += ` AND shift_date = ?`;
      params.push(filters.shiftDate);
    }
    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }

    sql += ` ORDER BY shift_date DESC, start_time`;

    return Database.all<Shift>(this.db, sql, params);
  }

  async updateDriver(shiftId: string, newDriverId: string): Promise<Shift | undefined> {
    const now = new Date().toISOString();
    const sql = `UPDATE shifts SET driver_id = ?, updated_at = ? WHERE id = ?`;
    await Database.run(this.db, sql, [newDriverId, now, shiftId]);
    return this.findById(shiftId);
  }
}
