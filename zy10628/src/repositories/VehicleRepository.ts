import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { Vehicle } from '../types';

export class VehicleRepository {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async create(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<Vehicle> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO vehicles (id, plate_number, vehicle_type, capacity, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await Database.run(this.db, sql, [
      id, vehicle.plateNumber, vehicle.vehicleType, vehicle.capacity,
      vehicle.status, now, now
    ]);

    return this.findById(id) as Promise<Vehicle>;
  }

  async findById(id: string): Promise<Vehicle | undefined> {
    const sql = `
      SELECT 
        id, plate_number as plateNumber,
        vehicle_type as vehicleType,
        capacity, status,
        created_at as createdAt, updated_at as updatedAt
      FROM vehicles WHERE id = ?
    `;
    return Database.get<Vehicle>(this.db, sql, [id]);
  }

  async findAll(): Promise<Vehicle[]> {
    const sql = `
      SELECT 
        id, plate_number as plateNumber,
        vehicle_type as vehicleType,
        capacity, status,
        created_at as createdAt, updated_at as updatedAt
      FROM vehicles ORDER BY plate_number
    `;
    return Database.all<Vehicle>(this.db, sql);
  }
}
