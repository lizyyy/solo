import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { Inspector } from '../types';

export class InspectorModel {
  static async create(inspector: Omit<Inspector, 'id' | 'createdAt' | 'updatedAt'>): Promise<Inspector> {
    const id = uuidv4();
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO inspectors (id, employeeId, name, department, phone, email, certificationLevel, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, inspector.employeeId, inspector.name, inspector.department, inspector.phone, inspector.email, inspector.certificationLevel, inspector.status, now, now],
        function(err) {
          if (err) reject(err);
          else resolve({ ...inspector, id, createdAt: now, updatedAt: now });
        }
      );
    });
  }

  static async findAll(): Promise<Inspector[]> {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM inspectors ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Inspector[]);
      });
    });
  }

  static async findById(id: string): Promise<Inspector | undefined> {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM inspectors WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row as Inspector | undefined);
      });
    });
  }
}
