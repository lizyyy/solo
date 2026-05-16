const db = require('../config/database');
const crypto = require('crypto');

const STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  DUPLICATE: 'DUPLICATE',
  CONFLICT: 'CONFLICT',
  MANUAL_RESOLVED: 'MANUAL_RESOLVED'
};

class IdempotentRequest {
  static _deepSortKeys(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._deepSortKeys(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
      sortedObj[key] = this._deepSortKeys(obj[key]);
    }
    return sortedObj;
  }

  static generateFingerprint(payload) {
    const deeplySorted = this._deepSortKeys(payload);
    const sortedPayload = JSON.stringify(deeplySorted);
    return crypto.createHash('sha256').update(sortedPayload).digest('hex');
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      const now = Math.floor(Date.now() / 1000);
      const payloadFingerprint = this.generateFingerprint(data.payload);
      const expiredAt = now + data.time_window;

      const sql = `INSERT INTO idempotent_requests 
        (request_no, business_type, idempotent_key, time_window, payload, 
         payload_fingerprint, status, created_at, updated_at, expired_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [
        data.request_no,
        data.business_type,
        data.idempotent_key,
        data.time_window,
        JSON.stringify(data.payload),
        payloadFingerprint,
        STATUS.PENDING,
        now,
        now,
        expiredAt
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...data, payload_fingerprint: payloadFingerprint });
        }
      });
    });
  }

  static findByRequestNo(requestNo) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM idempotent_requests WHERE request_no = ?`, [requestNo], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          row.payload = JSON.parse(row.payload);
          if (row.result) {
            row.result = JSON.parse(row.result);
          }
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  static findByIdempotentKey(idempotentKey, businessType = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM idempotent_requests WHERE idempotent_key = ?`;
      let params = [idempotentKey];

      if (businessType) {
        sql += ` AND business_type = ?`;
        params.push(businessType);
      }

      sql += ` ORDER BY created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            row.payload = JSON.parse(row.payload);
            if (row.result) {
              row.result = JSON.parse(row.result);
            }
          });
          resolve(rows);
        }
      });
    });
  }

  static updateStatus(id, status, result = null) {
    return new Promise((resolve, reject) => {
      const now = Math.floor(Date.now() / 1000);
      let sql = `UPDATE idempotent_requests SET status = ?, updated_at = ?`;
      let params = [status, now];

      if (result !== null) {
        sql += `, result = ?`;
        params.push(JSON.stringify(result));
      }

      sql += ` WHERE id = ?`;
      params.push(id);

      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  static findActiveInWindow(idempotentKey, businessType, now = null) {
    return new Promise((resolve, reject) => {
      const currentTime = now || Math.floor(Date.now() / 1000);
      const sql = `SELECT * FROM idempotent_requests 
                   WHERE idempotent_key = ? 
                   AND business_type = ? 
                   AND expired_at > ?
                   ORDER BY created_at DESC`;

      db.all(sql, [idempotentKey, businessType, currentTime], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            row.payload = JSON.parse(row.payload);
            if (row.result) {
              row.result = JSON.parse(row.result);
            }
          });
          resolve(rows);
        }
      });
    });
  }

  static list(filters = {}, page = 1, pageSize = 20) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM idempotent_requests WHERE 1=1`;
      let countSql = `SELECT COUNT(*) as total FROM idempotent_requests WHERE 1=1`;
      let params = [];

      if (filters.business_type) {
        sql += ` AND business_type = ?`;
        countSql += ` AND business_type = ?`;
        params.push(filters.business_type);
      }

      if (filters.status) {
        sql += ` AND status = ?`;
        countSql += ` AND status = ?`;
        params.push(filters.status);
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
              row.payload = JSON.parse(row.payload);
              if (row.result) {
                row.result = JSON.parse(row.result);
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
      let sql = `SELECT * FROM idempotent_requests WHERE 1=1`;
      let params = [];

      if (filters.business_type) {
        sql += ` AND business_type = ?`;
        params.push(filters.business_type);
      }

      if (filters.status) {
        sql += ` AND status = ?`;
        params.push(filters.status);
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
            row.payload = JSON.parse(row.payload);
            if (row.result) {
              row.result = JSON.parse(row.result);
            }
          });
          resolve(rows);
        }
      });
    });
  }
}

module.exports = { IdempotentRequest, STATUS };
