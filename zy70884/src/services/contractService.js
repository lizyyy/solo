const { run, get, all } = require('../database/db');
const { logAction, ACTION_TYPES, getLogsByContractId } = require('./auditService');

const createContract = async (batchId, contractData) => {
  const sql = `
    INSERT INTO contracts 
    (batch_id, contract_no, contract_name, party_a, party_b, amount, seal_type, authorizer, express_no, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return run(sql, [
    batchId,
    contractData.contract_no || null,
    contractData.contract_name,
    contractData.party_a || null,
    contractData.party_b || null,
    contractData.amount || null,
    contractData.seal_type,
    contractData.authorizer || null,
    contractData.express_no || null,
    contractData.metadata ? JSON.stringify(contractData.metadata) : null
  ]);
};

const getContractById = async (id) => {
  const sql = 'SELECT * FROM contracts WHERE id = ?';
  const contract = await get(sql, [id]);
  if (contract && contract.metadata) {
    contract.metadata = JSON.parse(contract.metadata);
  }
  return contract;
};

const getContractsByBatchId = async (batchId) => {
  const sql = 'SELECT * FROM contracts WHERE batch_id = ? ORDER BY created_at DESC';
  const contracts = await all(sql, [batchId]);
  return contracts.map(c => {
    if (c.metadata) c.metadata = JSON.parse(c.metadata);
    return c;
  });
};

const searchContracts = async ({ seal_type, authorizer, express_no }) => {
  let sql = 'SELECT * FROM contracts WHERE 1=1';
  const params = [];

  if (seal_type) {
    sql += ' AND seal_type = ?';
    params.push(seal_type);
  }
  if (authorizer) {
    sql += ' AND authorizer = ?';
    params.push(authorizer);
  }
  if (express_no) {
    sql += ' AND express_no = ?';
    params.push(express_no);
  }

  sql += ' ORDER BY created_at DESC';
  const contracts = await all(sql, params);
  return contracts.map(c => {
    if (c.metadata) c.metadata = JSON.parse(c.metadata);
    return c;
  });
};

const getContractTraceByExpressNo = async (expressNo) => {
  const contracts = await searchContracts({ express_no: expressNo });
  if (contracts.length === 0) {
    return null;
  }

  const contract = contracts[0];
  const logs = await getLogsByContractId(contract.id);

  return {
    contract,
    auditLogs: logs
  };
};

const updateContractStatus = async (id, status, handler, reason = null) => {
  const contract = await getContractById(id);
  if (!contract) {
    throw new Error('合同不存在');
  }

  const sql = 'UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  await run(sql, [status, id]);

  let actionType;
  switch (status) {
    case 'approved':
      actionType = ACTION_TYPES.CONTRACT_APPROVED;
      break;
    case 'rejected':
      actionType = ACTION_TYPES.CONTRACT_REJECTED;
      break;
    case 'returned':
      actionType = ACTION_TYPES.CONTRACT_RETURNED;
      break;
    default:
      actionType = ACTION_TYPES.STATUS_CHANGED;
  }

  await logAction({
    contractId: id,
    batchId: contract.batch_id,
    actionType,
    actionReason: reason,
    handler,
    oldStatus: contract.status,
    newStatus: status
  });

  return { success: true, id, status };
};

const markAsProcessed = async (id, handler, remark = null) => {
  const result = await updateContractStatus(id, 'processed', handler, remark);
  if (remark) {
    await run('UPDATE contracts SET remark = ? WHERE id = ?', [remark, id]);
  }
  return result;
};

const returnForModification = async (id, handler, reason) => {
  return updateContractStatus(id, 'returned', handler, reason);
};

const recordUnauthorizedSeal = async (id, handler, reason) => {
  const contract = await getContractById(id);
  await logAction({
    contractId: id,
    batchId: contract.batch_id,
    actionType: ACTION_TYPES.UNAUTHORIZED_SEAL,
    actionReason: reason,
    handler,
    oldStatus: contract.status,
    newStatus: contract.status
  });
  return { success: true, id, message: '已记录越权盖章事件' };
};

const recordAttachmentSupplement = async (id, handler, reason) => {
  const contract = await getContractById(id);
  await logAction({
    contractId: id,
    batchId: contract.batch_id,
    actionType: ACTION_TYPES.ATTACHMENT_SUPPLEMENT,
    actionReason: reason,
    handler,
    oldStatus: contract.status,
    newStatus: contract.status
  });
  return { success: true, id, message: '已记录补盖附件事件' };
};

const recordWithdrawResubmit = async (id, handler, reason) => {
  const contract = await getContractById(id);
  await logAction({
    contractId: id,
    batchId: contract.batch_id,
    actionType: ACTION_TYPES.WITHDRAW_RESUBMIT,
    actionReason: reason,
    handler,
    oldStatus: contract.status,
    newStatus: 'pending'
  });
  await run('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['pending', id]);
  return { success: true, id, message: '已记录撤回重提事件' };
};

module.exports = {
  createContract,
  getContractById,
  getContractsByBatchId,
  searchContracts,
  getContractTraceByExpressNo,
  updateContractStatus,
  markAsProcessed,
  returnForModification,
  recordUnauthorizedSeal,
  recordAttachmentSupplement,
  recordWithdrawResubmit
};
