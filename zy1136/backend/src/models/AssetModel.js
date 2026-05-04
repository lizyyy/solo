import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class AssetModel {
  static create(assetData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO assets (
        id, name, type, mac_address, serial_number, 
        department, owner, location, purchase_date, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      assetData.name,
      assetData.type,
      assetData.mac_address,
      assetData.serial_number,
      assetData.department,
      assetData.owner,
      assetData.location,
      assetData.purchase_date,
      assetData.status || 'active',
      assetData.notes,
      now,
      now
    );
    
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  }

  static findByMac(macAddress) {
    return db.prepare('SELECT * FROM assets WHERE mac_address = ?').get(macAddress);
  }

  static findAll(filters = {}) {
    let sql = 'SELECT * FROM assets WHERE 1=1';
    const params = [];

    if (filters.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.department) {
      sql += ' AND department = ?';
      params.push(filters.department);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.owner) {
      sql += ' AND owner = ?';
      params.push(filters.owner);
    }
    if (filters.search) {
      sql += ' AND (name LIKE ? OR mac_address LIKE ? OR serial_number LIKE ?)';
      const search = `%${filters.search}%`;
      params.push(search, search, search);
    }

    sql += ' ORDER BY created_at DESC';

    return db.prepare(sql).all(...params);
  }

  static update(id, assetData) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'type', 'mac_address', 'serial_number',
      'department', 'owner', 'location', 'purchase_date', 'status', 'notes'
    ];

    allowedFields.forEach(field => {
      if (assetData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(assetData[field]);
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = ?');
    values.push(now, id);

    const stmt = db.prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM assets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
    const byType = db.prepare(`
      SELECT type, COUNT(*) as count FROM assets GROUP BY type
    `).all();
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM assets GROUP BY status
    `).all();
    const byDepartment = db.prepare(`
      SELECT department, COUNT(*) as count FROM assets 
      WHERE department IS NOT NULL GROUP BY department
    `).all();

    return {
      total,
      byType,
      byStatus,
      byDepartment
    };
  }
}

export default AssetModel;
