import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { Device } from '../types';

export class DeviceModel {
  static async create(device: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>): Promise<Device> {
    const id = uuidv4();
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO devices (id, code, name, type, location, department, manufacturer, model, installDate, warrantyExpireDate, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, device.code, device.name, device.type, device.location, device.department, device.manufacturer, device.model, device.installDate, device.warrantyExpireDate, device.status, now, now],
        function(err) {
          if (err) reject(err);
          else resolve({ ...device, id, createdAt: now, updatedAt: now });
        }
      );
    });
  }

  static async findAll(): Promise<Device[]> {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM devices ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Device[]);
      });
    });
  }

  static async findById(id: string): Promise<Device | undefined> {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM devices WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row as Device | undefined);
      });
    });
  }

  static async findByCode(code: string): Promise<Device | undefined> {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM devices WHERE code = ?`, [code], (err, row) => {
        if (err) reject(err);
        else resolve(row as Device | undefined);
      });
    });
  }
}
