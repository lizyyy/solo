const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class AuditLog {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const {
        request_id,
        order_id,
        actor_id,
        actor_type,
        action,
        details = {}
      } = data;

      const sql = `INSERT INTO audit_logs 
        (id, request_id, order_id, actor_id, actor_type, action, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [id, request_id, order_id, actor_id, actor_type, action, JSON.stringify(details)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...data });
        }
      });
    });
  }

  static findByRequestId(request_id) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM audit_logs 
              WHERE request_id = ? 
              ORDER BY created_at ASC`, [request_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : {}
          }));
          resolve(rows);
        }
      });
    });
  }

  static findByOrderId(order_id) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM audit_logs 
              WHERE order_id = ? 
              ORDER BY created_at ASC`, [order_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : {}
          }));
          resolve(rows);
        }
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM audit_logs ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : {}
          }));
          resolve(rows);
        }
      });
    });
  }
}

module.exports = AuditLog;
