const { runAsync, allAsync } = require('../database/database');

const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  CONFIRM: 'confirm',
  REJECT: 'reject',
  APPROVE: 'approve',
  ISSUE: 'issue',
  ASSIGN: 'assign'
};

const TABLE_NAMES = {
  PROJECTS: 'projects',
  MILESTONES: 'milestones',
  ACCEPTANCES: 'acceptances',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PAYMENT_ASSIGNMENTS: 'payment_assignments'
};

const auditService = {
  logCreate: async (tableName, recordId, userId, newData = null) => {
    const newVal = newData ? JSON.stringify(newData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, new_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.CREATE, newVal, userId || 'system']
    );
  },

  logUpdate: async (tableName, recordId, userId, oldData = null, newData = null) => {
    const oldVal = oldData ? JSON.stringify(oldData) : null;
    const newVal = newData ? JSON.stringify(newData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, old_value, new_value, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.UPDATE, oldVal, newVal, userId || 'system']
    );
  },

  logDelete: async (tableName, recordId, userId, oldData = null) => {
    const oldVal = oldData ? JSON.stringify(oldData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, old_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.DELETE, oldVal, userId || 'system']
    );
  },

  logConfirm: async (tableName, recordId, userId, newData = null) => {
    const newVal = newData ? JSON.stringify(newData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, new_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.CONFIRM, newVal, userId || 'system']
    );
  },

  logReject: async (tableName, recordId, userId, reason = null) => {
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, new_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.REJECT, reason ? JSON.stringify({ reason }) : null, userId || 'system']
    );
  },

  logApprove: async (tableName, recordId, userId, newData = null) => {
    const newVal = newData ? JSON.stringify(newData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, new_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.APPROVE, newVal, userId || 'system']
    );
  },

  logIssue: async (tableName, recordId, userId, newData = null) => {
    const newVal = newData ? JSON.stringify(newData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, new_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.ISSUE, newVal, userId || 'system']
    );
  },

  logAssign: async (tableName, recordId, userId, newData = null) => {
    const newVal = newData ? JSON.stringify(newData) : null;
    await runAsync(
      `INSERT INTO audit_logs (table_name, record_id, action, new_value, user_id) VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, AUDIT_ACTIONS.ASSIGN, newVal, userId || 'system']
    );
  },

  getAuditLogs: async (tableName = null, recordId = null) => {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (tableName) {
      query += ' AND table_name = ?';
      params.push(tableName);
    }

    if (recordId) {
      query += ' AND record_id = ?';
      params.push(recordId);
    }

    query += ' ORDER BY created_at DESC';

    return await allAsync(query, params);
  },

  getRecordHistory: async (tableName, recordId) => {
    const logs = await auditService.getAuditLogs(tableName, recordId);
    return {
      table_name: tableName,
      record_id: recordId,
      history: logs.map(log => ({
        action: log.action,
        timestamp: log.created_at,
        user: log.user_id,
        old_value: log.old_value ? JSON.parse(log.old_value) : null,
        new_value: log.new_value ? JSON.parse(log.new_value) : null
      }))
    };
  }
};

module.exports = { auditService, AUDIT_ACTIONS, TABLE_NAMES };
