import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType?: string;
  brand?: string;
  createdAt: string;
  updatedAt: string;
}

export class VehicleDAO {
  static getAll(): Vehicle[] {
    const stmt = db.prepare(`
      SELECT 
        id, plate_number as plateNumber, vehicle_type as vehicleType, brand,
        created_at as createdAt, updated_at as updatedAt
      FROM vehicles
      ORDER BY created_at DESC
    `);
    return stmt.all() as Vehicle[];
  }

  static getById(id: string): Vehicle | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, plate_number as plateNumber, vehicle_type as vehicleType, brand,
        created_at as createdAt, updated_at as updatedAt
      FROM vehicles WHERE id = ?
    `);
    return stmt.get(id) as Vehicle | undefined;
  }

  static getByPlateNumber(plateNumber: string): Vehicle | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, plate_number as plateNumber, vehicle_type as vehicleType, brand,
        created_at as createdAt, updated_at as updatedAt
      FROM vehicles WHERE plate_number = ?
    `);
    return stmt.get(plateNumber) as Vehicle | undefined;
  }

  static create(data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Vehicle {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO vehicles (id, plate_number, vehicle_type, brand, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.plateNumber, data.vehicleType || null, data.brand || null, now, now);
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<Omit<Vehicle, 'id' | 'createdAt'>>): Vehicle | null {
    const vehicle = this.getById(id);
    if (!vehicle) return null;

    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.plateNumber !== undefined) { updates.push('plate_number = ?'); values.push(data.plateNumber); }
    if (data.vehicleType !== undefined) { updates.push('vehicle_type = ?'); values.push(data.vehicleType); }
    if (data.brand !== undefined) { updates.push('brand = ?'); values.push(data.brand); }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.getById(id) || null;
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM vehicles WHERE id = ?');
    const result = stmt.run(id);
    return (result.changes || 0) > 0;
  }
}

export default VehicleDAO;
