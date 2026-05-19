import db from '../config/database';
import { PersonInCharge } from '../types';

export class PersonInChargeModel {
  static create(data: Omit<PersonInCharge, 'id' | 'created_at' | 'updated_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO person_in_charge (name, phone, role)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(data.name, data.phone, data.role);
    return Number(result.lastInsertRowid);
  }

  static getById(id: number): PersonInCharge | undefined {
    const stmt = db.prepare('SELECT * FROM person_in_charge WHERE id = ?');
    return stmt.get(id) as PersonInCharge | undefined;
  }

  static getByPhone(phone: string): PersonInCharge | undefined {
    const stmt = db.prepare('SELECT * FROM person_in_charge WHERE phone = ?');
    return stmt.get(phone) as PersonInCharge | undefined;
  }

  static getAll(): PersonInCharge[] {
    const stmt = db.prepare('SELECT * FROM person_in_charge ORDER BY name');
    return stmt.all() as PersonInCharge[];
  }

  static getByRole(role: string): PersonInCharge[] {
    const stmt = db.prepare('SELECT * FROM person_in_charge WHERE role = ? ORDER BY name');
    return stmt.all(role) as PersonInCharge[];
  }
}
