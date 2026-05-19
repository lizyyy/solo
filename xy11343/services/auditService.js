const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

const createAuditLog = (action, entityType, entityId, requestId, operator, details = {}) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const detailsStr = JSON.stringify(details);
    
    db.run(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, request_id, operator, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, action, entityType, entityId, requestId, operator, detailsStr],
      (err) => {
        if (err) {
          logger.error('Failed to create audit log', { error: err.message, action, entityType });
          reject(err);
        } else {
          logger.info('Audit log created', { action, entityType, entityId });
          resolve(id);
        }
      }
    );
  });
};

const getAuditLogs = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.entity_type) {
      query += ' AND entity_type = ?';
      params.push(filters.entity_type);
    }
    if (filters.request_id) {
      query += ' AND request_id = ?';
      params.push(filters.request_id);
    }
    if (filters.start_date) {
      query += ' AND created_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND created_at <= ?';
      params.push(filters.end_date);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    db.all(query, params, (err, rows) => {
      if (err) {
        logger.error('Failed to get audit logs', { error: err.message });
        reject(err);
      } else {
        const logs = rows.map(row => ({
          ...row,
          details: row.details ? JSON.parse(row.details) : null
        }));
        resolve(logs);
      }
    });
  });
};

module.exports = { createAuditLog, getAuditLogs };
