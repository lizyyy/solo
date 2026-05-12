import { db } from '../database';
import { Equipment, EquipmentStatus } from '../models';

export class EquipmentRepository {
  async create(data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipment> {
    const id = db.generateId();
    const now = db.now();
    await db.run(
      `INSERT INTO equipment (id, name, code, location, type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.code, data.location, data.type, data.status || EquipmentStatus.RUNNING, now, now]
    );
    return this.findById(id) as Promise<Equipment>;
  }

  async findById(id: string): Promise<Equipment | undefined> {
    return db.get<Equipment>(
      `SELECT id, name, code, location, type, status, 
              created_at as createdAt, updated_at as updatedAt
       FROM equipment WHERE id = ?`,
      [id]
    );
  }

  async findByCode(code: string): Promise<Equipment | undefined> {
    return db.get<Equipment>(
      `SELECT id, name, code, location, type, status, 
              created_at as createdAt, updated_at as updatedAt
       FROM equipment WHERE code = ?`,
      [code]
    );
  }

  async findAll(): Promise<Equipment[]> {
    return db.all<Equipment>(
      `SELECT id, name, code, location, type, status, 
              created_at as createdAt, updated_at as updatedAt
       FROM equipment ORDER BY created_at DESC`
    );
  }

  async updateStatus(id: string, status: EquipmentStatus): Promise<void> {
    const now = db.now();
    await db.run(
      `UPDATE equipment SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, id]
    );
  }
}

export const equipmentRepository = new EquipmentRepository();
