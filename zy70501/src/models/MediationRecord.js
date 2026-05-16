const db = require('../config/database');

const ACTIONS = {
  CREATE: 'CREATE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  MANUAL_CORRECTION: 'MANUAL_CORRECTION',
  EXCEPTION_HANDLED: 'EXCEPTION_HANDLED',
  HISTORY_REUSED: 'HISTORY_REUSED'
};

class MediationRecord {
  static create(data) {
    return new Promise((resolve, reject) => {
      const now = Math.floor(Date.now() / 1000);
      const sql = `INSERT INTO mediation_records 
        (request_id, request_no, action, operator, reason, 
         before_status, after_status, original_input, 
         processing_basis, final_conclusion, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [
        data.request_id,
        data.request_no,
        data.action,
        data.operator || 'system',
        data.reason,
        data.before_status,
        data.after_status,
        data.original_input ? JSON.stringify(data.original_input) : null,
        data.processing_basis,
        data.final_conclusion,
        now
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...data });
        }
      });
    });
  }

  static findByRequestNo(requestNo) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM mediation_records WHERE request_no = ? ORDER BY created_at DESC`, [requestNo], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            if (row.original_input) {
              row.original_input = JSON.parse(row.original_input);
            }
          });
          resolve(rows);
        }
      });
    });
  }

  static list(filters = {}, page = 1, pageSize = 20) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM mediation_records WHERE 1=1`;
      let countSql = `SELECT COUNT(*) as total FROM mediation_records WHERE 1=1`;
      let params = [];

      if (filters.action) {
        sql += ` AND action = ?`;
        countSql += ` AND action = ?`;
        params.push(filters.action);
      }

      if (filters.operator) {
        sql += ` AND operator = ?`;
        countSql += ` AND operator = ?`;
        params.push(filters.operator);
      }

      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(pageSize, (page - 1) * pageSize);

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        db.get(countSql, params.slice(0, -2), (err, countRow) => {
          if (err) {
            reject(err);
          } else {
            rows.forEach(row => {
              if (row.original_input) {
                row.original_input = JSON.parse(row.original_input);
              }
            });
            resolve({
              data: rows,
              total: countRow.total,
              page,
              pageSize
            });
          }
        });
      });
    });
  }

  static getAllForExport(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM mediation_records WHERE 1=1`;
      let params = [];

      if (filters.request_no) {
        sql += ` AND request_no = ?`;
        params.push(filters.request_no);
      }

      if (filters.start_time) {
        sql += ` AND created_at >= ?`;
        params.push(filters.start_time);
      }

      if (filters.end_time) {
        sql += ` AND created_at <= ?`;
        params.push(filters.end_time);
      }

      sql += ` ORDER BY created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            if (row.original_input) {
              row.original_input = JSON.parse(row.original_input);
            }
          });
          resolve(rows);
        }
      });
    });
  }
}

module.exports = { MediationRecord, ACTIONS };
