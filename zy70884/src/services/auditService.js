const { run, all } = require('../database/db');

const ACTION_TYPES = {
  BATCH_CREATED: 'batch_created',
  BATCH_APPROVED: 'batch_approved',
  BATCH_REJECTED: 'batch_rejected',
  BATCH_RETURNED: 'batch_returned',
  CONTRACT_APPROVED: 'contract_approved',
  CONTRACT_REJECTED: 'contract_rejected',
  CONTRACT_RETURNED: 'contract_returned',
  UNAUTHORIZED_SEAL: 'unauthorized_seal',
  ATTACHMENT_SUPPLEMENT: 'attachment_supplement',
  WITHDRAW_RESUBMIT: 'withdraw_resubmit',
  EXPORT: 'export',
  STATUS_CHANGED: 'status_changed'
};

const logAction = async ({
  contractId = null,
  batchId = null,
  actionType,
  actionReason = null,
  handler,
  oldStatus = null,
  newStatus = null
}) => {
  const sql = `
    INSERT INTO audit_logs 
    (contract_id, batch_id, action_type, action_reason, handler, old_status, new_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  return run(sql, [contractId, batchId, actionType, actionReason, handler, oldStatus, newStatus]);
};

const getLogsByContractId = async (contractId) => {
  const sql = `
    SELECT * FROM audit_logs 
    WHERE contract_id = ? 
    ORDER BY created_at DESC
  `;
  return all(sql, [contractId]);
};

const getLogsByBatchId = async (batchId) => {
  const sql = `
    SELECT * FROM audit_logs 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `;
  return all(sql, [batchId]);
};

const getLogsByActionType = async (actionType) => {
  const sql = `
    SELECT * FROM audit_logs 
    WHERE action_type = ? 
    ORDER BY created_at DESC
  `;
  return all(sql, [actionType]);
};

const getAllLogs = async (limit = 100) => {
  const sql = `
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return all(sql, [limit]);
};

module.exports = {
  ACTION_TYPES,
  logAction,
  getLogsByContractId,
  getLogsByBatchId,
  getLogsByActionType,
  getAllLogs
};
