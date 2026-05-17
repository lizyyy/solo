import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { Driver } from '../types';

export class DriverRepository {
  private db: sqlite3.Database;

  constructor(db: sqlite3.Database) {
    this.db = db;
  }

  async create(driver: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>): Promise<Driver> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO drivers (id, name, phone, license_number, license_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await Database.run(this.db, sql, [
      id, driver.name, driver.phone, driver.licenseNumber,
      driver.licenseType, driver.status, now, now
    ]);

    return this.findById(id) as Promise<Driver>;
  }

  async findById(id: string): Promise<Driver | undefined> {
    const sql = `
      SELECT 
        id, name, phone, license_number as licenseNumber,
        license_type as licenseType, status,
        created_at as createdAt, updated_at as updatedAt
      FROM drivers WHERE id = ?
    `;
    return Database.get<Driver>(this.db, sql, [id]);
  }

  async findAll(): Promise<Driver[]> {
    const sql = `
      SELECT 
        id, name, phone, license_number as licenseNumber,
        license_type as licenseType, status,
        created_at as createdAt, updated_at as updatedAt
      FROM drivers ORDER BY name
    `;
    return Database.all<Driver>(this.db, sql);
  }

  async update(id: string, driver: Partial<Driver>): Promise<Driver | undefined> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: unknown[] = [];

    if (driver.name) { updates.push('name = ?'); params.push(driver.name); }
    if (driver.phone) { updates.push('phone = ?'); params.push(driver.phone); }
    if (driver.status) { updates.push('status = ?'); params.push(driver.status); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const sql = `UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`;
    await Database.run(this.db, sql, params);
    return this.findById(id);
  }
}
