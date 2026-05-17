const db = require('../config/database');

class ExtensionDAO {
  static generateExtensionNo() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `EXT${timestamp}${random}`;
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const extensionNo = this.generateExtensionNo();
      const sql = `INSERT INTO trial_extensions 
        (extension_no, tenant_id, original_trial_end_date, requested_extension_days, 
         new_trial_end_date, extension_reason, sales_notes, salesperson_id, salesperson_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      const params = [
        extensionNo,
        data.tenant_id,
        data.original_trial_end_date,
        data.requested_extension_days,
        data.new_trial_end_date,
        data.extension_reason,
        data.sales_notes || null,
        data.salesperson_id,
        data.salesperson_name,
        data.status || 'extension_pending'
      ];

      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, extension_no: extensionNo });
      });
    });
  }

  static async findByTenantId(tenantId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM trial_extensions WHERE tenant_id = ? ORDER BY created_at DESC`;
      db.all(sql, [tenantId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async findPendingByTenantId(tenantId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM trial_extensions 
                   WHERE tenant_id = ? AND status = 'extension_pending'`;
      db.all(sql, [tenantId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT te.*, t.tenant_name 
                   FROM trial_extensions te
                   LEFT JOIN tenants t ON te.tenant_id = t.tenant_id
                   WHERE te.id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT te.*, t.tenant_name 
                 FROM trial_extensions te
                 LEFT JOIN tenants t ON te.tenant_id = t.tenant_id
                 WHERE 1=1`;
      const params = [];

      if (filters.status) {
        sql += ` AND te.status = ?`;
        params.push(filters.status);
      }
      if (filters.tenant_id) {
        sql += ` AND te.tenant_id = ?`;
        params.push(filters.tenant_id);
      }
      if (filters.salesperson_id) {
        sql += ` AND te.salesperson_id = ?`;
        params.push(filters.salesperson_id);
      }

      sql += ` ORDER BY te.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateStatus(id, status, approverId, approverName, comment) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE trial_extensions 
                   SET status = ?, approver_id = ?, approver_name = ?, approval_comment = ?, 
                       approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`;
      db.run(sql, [status, approverId, approverName, comment, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static async addHistory(extensionId, action, oldStatus, newStatus, operatorId, operatorName, comment) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO extension_history 
        (extension_id, action, old_status, new_status, operator_id, operator_name, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      
      db.run(sql, [extensionId, action, oldStatus, newStatus, operatorId, operatorName, comment], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }

  static async getHistory(extensionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM extension_history WHERE extension_id = ? ORDER BY created_at DESC`;
      db.all(sql, [extensionId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async createImportRecord(batchNo, rowNumber, rawData, errorMessage, status) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO import_records 
        (batch_no, row_number, raw_data, error_message, status)
        VALUES (?, ?, ?, ?, ?)`;
      
      db.run(sql, [batchNo, rowNumber, rawData, errorMessage, status], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
  }

  static async getImportRecords(batchNo) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM import_records WHERE batch_no = ? ORDER BY row_number`;
      db.all(sql, [batchNo], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = ExtensionDAO;
