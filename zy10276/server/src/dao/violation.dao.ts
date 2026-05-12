import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface Violation {
  id: string;
  violationNumber?: string;
  plateNumber: string;
  vehicleId?: string;
  violationTime: string;
  violationType: string;
  location?: string;
  description?: string;
  points: number;
  fineAmount: number;
  status: string;
  matchedShiftId?: string;
  matchedDriverId?: string;
  importBatchId?: string;
  importedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ViolationFilter {
  plateNumber?: string;
  driverName?: string;
  status?: string;
  violationType?: string;
  startDate?: string;
  endDate?: string;
}

export class ViolationDAO {
  static getAll(): Violation[] {
    const stmt = db.prepare(`
      SELECT 
        v.id, v.violation_number as violationNumber, v.plate_number as plateNumber,
        v.vehicle_id as vehicleId, v.violation_time as violationTime,
        v.violation_type as violationType, v.location, v.description,
        v.points, v.fine_amount as fineAmount, v.status,
        v.matched_shift_id as matchedShiftId, v.matched_driver_id as matchedDriverId,
        v.import_batch_id as importBatchId, v.imported_by as importedBy,
        v.created_at as createdAt, v.updated_at as updatedAt
      FROM violations v
      ORDER BY v.violation_time DESC
    `);
    return stmt.all() as Violation[];
  }

  static filter(params: ViolationFilter): Violation[] {
    let query = `
      SELECT DISTINCT
        v.id, v.violation_number as violationNumber, v.plate_number as plateNumber,
        v.vehicle_id as vehicleId, v.violation_time as violationTime,
        v.violation_type as violationType, v.location, v.description,
        v.points, v.fine_amount as fineAmount, v.status,
        v.matched_shift_id as matchedShiftId, v.matched_driver_id as matchedDriverId,
        v.import_batch_id as importBatchId, v.imported_by as importedBy,
        v.created_at as createdAt, v.updated_at as updatedAt
      FROM violations v
      LEFT JOIN drivers d ON v.matched_driver_id = d.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (params.plateNumber) {
      query += ` AND v.plate_number LIKE ?`;
      values.push(`%${params.plateNumber}%`);
    }

    if (params.driverName) {
      query += ` AND d.name LIKE ?`;
      values.push(`%${params.driverName}%`);
    }

    if (params.status) {
      query += ` AND v.status = ?`;
      values.push(params.status);
    }

    if (params.violationType) {
      query += ` AND v.violation_type = ?`;
      values.push(params.violationType);
    }

    if (params.startDate) {
      query += ` AND v.violation_time >= ?`;
      values.push(params.startDate);
    }

    if (params.endDate) {
      query += ` AND v.violation_time <= ?`;
      values.push(`${params.endDate} 23:59:59`);
    }

    query += ` ORDER BY v.violation_time DESC`;

    const stmt = db.prepare(query);
    return stmt.all(...values) as Violation[];
  }

  static getById(id: string): Violation | undefined {
    const stmt = db.prepare(`
      SELECT 
        v.id, v.violation_number as violationNumber, v.plate_number as plateNumber,
        v.vehicle_id as vehicleId, v.violation_time as violationTime,
        v.violation_type as violationType, v.location, v.description,
        v.points, v.fine_amount as fineAmount, v.status,
        v.matched_shift_id as matchedShiftId, v.matched_driver_id as matchedDriverId,
        v.import_batch_id as importBatchId, v.imported_by as importedBy,
        v.created_at as createdAt, v.updated_at as updatedAt
      FROM violations v WHERE v.id = ?
    `);
    return stmt.get(id) as Violation | undefined;
  }

  static checkDuplicate(violationNumber?: string, plateNumber?: string, violationTime?: string): boolean {
    const conditions: string[] = [];
    const values: any[] = [];

    if (violationNumber) {
      conditions.push('violation_number = ?');
      values.push(violationNumber);
    }
    
    if (plateNumber && violationTime) {
      conditions.push('(plate_number = ? AND violation_time = ?)');
      values.push(plateNumber, violationTime);
    }

    if (conditions.length === 0) return false;

    const stmt = db.prepare(`SELECT COUNT(*) as count FROM violations WHERE ${conditions.join(' OR ')}`);
    const result = stmt.get(...values) as { count: number };
    return result.count > 0;
  }

  static create(data: Omit<Violation, 'id' | 'createdAt' | 'updatedAt'>): Violation {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO violations (
        id, violation_number, plate_number, vehicle_id, violation_time,
        violation_type, location, description, points, fine_amount, status,
        matched_shift_id, matched_driver_id, import_batch_id, imported_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.violationNumber || null, data.plateNumber, data.vehicleId || null,
      data.violationTime, data.violationType, data.location || null, data.description || null,
      data.points, data.fineAmount, data.status || 'imported',
      data.matchedShiftId || null, data.matchedDriverId || null,
      data.importBatchId || null, data.importedBy || null, now, now
    );
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<Omit<Violation, 'id' | 'createdAt' | 'updatedAt'>>): Violation | null {
    const violation = this.getById(id);
    if (!violation) return null;

    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      violationNumber: 'violation_number',
      plateNumber: 'plate_number',
      vehicleId: 'vehicle_id',
      violationTime: 'violation_time',
      violationType: 'violation_type',
      location: 'location',
      description: 'description',
      points: 'points',
      fineAmount: 'fine_amount',
      status: 'status',
      matchedShiftId: 'matched_shift_id',
      matchedDriverId: 'matched_driver_id',
      importBatchId: 'import_batch_id',
      importedBy: 'imported_by',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      const value = (data as any)[key];
      if (value !== undefined) {
        updates.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) return violation;

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE violations SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getById(id) || null;
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM violations WHERE id = ?');
    const result = stmt.run(id);
    return (result.changes || 0) > 0;
  }
}

export default ViolationDAO;
