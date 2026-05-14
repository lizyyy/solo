const crypto = require('crypto');
const { getConnection } = require('../database/schema');

const generateRequestFingerprint = (method, endpoint, body, headers = {}) => {
  const normalizedBody = typeof body === 'string' ? body : JSON.stringify(body || {});
  const normalizedHeaders = JSON.stringify({
    'content-type': headers['content-type'] || '',
    'user-agent': headers['user-agent'] || ''
  });
  const data = `${method}:${endpoint}:${normalizedBody}:${normalizedHeaders}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

const formatDate = (date) => {
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

const createIdempotencyRecord = async (data) => {
  const db = getConnection();
  return new Promise((resolve, reject) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    db.run(`INSERT INTO idempotency_keys (
      idempotency_key, service_name, api_endpoint, request_fingerprint,
      request_method, request_body, first_request_at, last_request_at,
      first_response_status, first_response_body, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      data.idempotencyKey,
      data.serviceName,
      data.apiEndpoint,
      data.requestFingerprint,
      data.requestMethod,
      typeof data.requestBody === 'string' ? data.requestBody : JSON.stringify(data.requestBody || {}),
      formatDate(now),
      formatDate(now),
      data.responseStatus,
      typeof data.responseBody === 'string' ? data.responseBody : JSON.stringify(data.responseBody || {}),
      formatDate(expiresAt),
      'active'
    ], function(err) {
      if (err) {
        db.close();
        return reject(err);
      }
      const recordId = this.lastID;
      
      db.run(`INSERT INTO request_logs (
        idempotency_key_id, idempotency_key, request_fingerprint,
        request_method, request_body, response_status, response_body,
        is_reused, is_conflict
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`, [
        recordId,
        data.idempotencyKey,
        data.requestFingerprint,
        data.requestMethod,
        typeof data.requestBody === 'string' ? data.requestBody : JSON.stringify(data.requestBody || {}),
        data.responseStatus,
        typeof data.responseBody === 'string' ? data.responseBody : JSON.stringify(data.responseBody || {})
      ], (logErr) => {
        db.close();
        if (logErr) return reject(logErr);
        resolve({ id: recordId, ...data });
      });
    });
  });
};

const findIdempotencyRecord = async (idempotencyKey) => {
  const db = getConnection();
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM idempotency_keys WHERE idempotency_key = ?`, [idempotencyKey], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const checkFingerprintMatch = (existingFingerprint, newFingerprint) => {
  return existingFingerprint === newFingerprint;
};

const handleDuplicateRequest = async (idempotencyKey, newRequest) => {
  const db = getConnection();
  return new Promise(async (resolve, reject) => {
    try {
      const existing = await findIdempotencyRecord(idempotencyKey);
      
      if (!existing) {
        db.close();
        return reject(new Error('Record not found'));
      }

      const fingerprintMatch = checkFingerprintMatch(existing.request_fingerprint, newRequest.requestFingerprint);
      const now = formatDate(new Date());
      
      if (!fingerprintMatch) {
        db.run(`UPDATE idempotency_keys 
                SET status = 'conflict', conflict_reason = 'request_fingerprint_mismatch', 
                    last_request_at = ?, request_count = request_count + 1, updated_at = ?
                WHERE id = ?`, [now, now, existing.id], (updateErr) => {
          if (updateErr) {
            db.close();
            return reject(updateErr);
          }
          
          db.run(`INSERT INTO request_logs (
            idempotency_key_id, idempotency_key, request_fingerprint,
            request_method, request_body, is_reused, is_conflict
          ) VALUES (?, ?, ?, ?, ?, 0, 1)`, [
            existing.id,
            idempotencyKey,
            newRequest.requestFingerprint,
            newRequest.requestMethod,
            typeof newRequest.requestBody === 'string' ? newRequest.requestBody : JSON.stringify(newRequest.requestBody || {})
          ], (logErr) => {
            db.close();
            if (logErr) return reject(logErr);
            resolve({
              action: 'conflict',
              reason: 'request_fingerprint_mismatch',
              existingRecord: existing
            });
          });
        });
      } else {
        db.run(`UPDATE idempotency_keys 
                SET last_request_at = ?, request_count = request_count + 1, updated_at = ?
                WHERE id = ?`, [now, now, existing.id], (updateErr) => {
          if (updateErr) {
            db.close();
            return reject(updateErr);
          }
          
          db.run(`INSERT INTO request_logs (
            idempotency_key_id, idempotency_key, request_fingerprint,
            request_method, request_body, response_status, response_body,
            is_reused, is_conflict
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`, [
            existing.id,
            idempotencyKey,
            newRequest.requestFingerprint,
            newRequest.requestMethod,
            typeof newRequest.requestBody === 'string' ? newRequest.requestBody : JSON.stringify(newRequest.requestBody || {}),
            existing.first_response_status,
            existing.first_response_body
          ], (logErr) => {
            db.close();
            if (logErr) return reject(logErr);
            resolve({
              action: 'reuse',
              existingRecord: existing
            });
          });
        });
      }
    } catch (error) {
      db.close();
      reject(error);
    }
  });
};

const queryRecords = async (filters = {}) => {
  const db = getConnection();
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM idempotency_keys WHERE 1=1`;
    const params = [];
    
    if (filters.serviceName) {
      query += ` AND service_name = ?`;
      params.push(filters.serviceName);
    }
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters.idempotencyKey) {
      query += ` AND idempotency_key LIKE ?`;
      params.push(`%${filters.idempotencyKey}%`);
    }
    if (filters.startDate) {
      query += ` AND first_request_at >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND first_request_at <= ?`;
      params.push(filters.endDate);
    }
    
    query += ` ORDER BY first_request_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }
    
    db.all(query, params, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const getRecordDetail = async (id) => {
  const db = getConnection();
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM idempotency_keys WHERE id = ?`, [id], (err, record) => {
      if (err) {
        db.close();
        return reject(err);
      }
      if (!record) {
        db.close();
        return resolve(null);
      }
      
      db.all(`SELECT * FROM request_logs WHERE idempotency_key_id = ? ORDER BY requested_at DESC`, [id], (logErr, logs) => {
        if (logErr) {
          db.close();
          return reject(logErr);
        }
        
        db.all(`SELECT * FROM audit_trails WHERE idempotency_key_id = ? ORDER BY created_at DESC`, [id], (auditErr, audits) => {
          db.close();
          if (auditErr) return reject(auditErr);
          resolve({ record, logs, audits });
        });
      });
    });
  });
};

const updateRecordStatus = async (id, newStatus, reason = '', actor = 'system') => {
  const db = getConnection();
  return new Promise(async (resolve, reject) => {
    try {
      const oldRecord = await getRecordDetail(id);
      if (!oldRecord) {
        db.close();
        return reject(new Error('Record not found'));
      }
      
      const now = formatDate(new Date());
      
      db.run(`UPDATE idempotency_keys SET status = ?, updated_at = ?, conflict_reason = ? WHERE id = ?`, 
        [newStatus, now, reason, id], (updateErr) => {
          if (updateErr) {
            db.close();
            return reject(updateErr);
          }
          
          db.run(`INSERT INTO audit_trails (
            idempotency_key_id, idempotency_key, action, old_status, new_status, details, actor
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            id,
            oldRecord.record.idempotency_key,
            'status_change',
            oldRecord.record.status,
            newStatus,
            reason,
            actor
          ], (auditErr) => {
            db.close();
            if (auditErr) return reject(auditErr);
            resolve({ success: true, newStatus });
          });
        });
    } catch (error) {
      db.close();
      reject(error);
    }
  });
};

const cleanupExpiredRecords = async () => {
  const db = getConnection();
  return new Promise((resolve, reject) => {
    const now = formatDate(new Date());
    db.run(`UPDATE idempotency_keys SET status = 'expired', updated_at = ? WHERE expires_at <= ? AND status = 'active'`, 
      [now, now], function(err) {
        db.close();
        if (err) return reject(err);
        resolve({ cleanedCount: this.changes });
      });
  });
};

const getStatistics = async () => {
  const db = getConnection();
  return new Promise((resolve, reject) => {
    db.get(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END) as conflict,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(request_count) as totalRequests
    FROM idempotency_keys`, (err, stats) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      db.get(`SELECT COUNT(*) as reused FROM request_logs WHERE is_reused = 1`, (reusedErr, reused) => {
        if (reusedErr) {
          db.close();
          return reject(reusedErr);
        }
        
        db.get(`SELECT COUNT(*) as conflicts FROM request_logs WHERE is_conflict = 1`, (conflictErr, conflicts) => {
          db.close();
          if (conflictErr) return reject(conflictErr);
          resolve({
            ...stats,
            reusedRequests: reused.reused,
            conflictRequests: conflicts.conflicts
          });
        });
      });
    });
  });
};

const batchImport = async (records) => {
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const record of records) {
    try {
      await createIdempotencyRecord(record);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ record: record.idempotencyKey, error: error.message });
    }
  }
  
  return results;
};

module.exports = {
  generateRequestFingerprint,
  createIdempotencyRecord,
  findIdempotencyRecord,
  handleDuplicateRequest,
  queryRecords,
  getRecordDetail,
  updateRecordStatus,
  cleanupExpiredRecords,
  getStatistics,
  batchImport,
  checkFingerprintMatch
};
