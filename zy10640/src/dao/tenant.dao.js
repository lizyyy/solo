const db = require('../config/database');

class TenantDAO {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO tenants 
        (tenant_id, tenant_name, industry, contact_person, contact_phone)
        VALUES (?, ?, ?, ?, ?)`;
      
      db.run(sql, [
        data.tenant_id,
        data.tenant_name,
        data.industry || null,
        data.contact_person || null,
        data.contact_phone || null
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }

  static async findById(tenantId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tenants WHERE tenant_id = ?`;
      db.get(sql, [tenantId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findAll() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tenants ORDER BY created_at DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = TenantDAO;
