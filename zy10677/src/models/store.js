const { v4: uuidv4 } = require('uuid');

const LEASE_STATUS = {
  RENTING: 'RENTING',
  INSPECTING: 'INSPECTING',
  PARTIAL_REFUND: 'PARTIAL_REFUND',
  SETTLED: 'SETTLED',
  REJECTED: 'REJECTED'
};

const REFUND_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  CONFLICT: 'CONFLICT',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED'
};

const database = {
  leases: new Map(),
  deposits: new Map(),
  inspectionItems: new Map(),
  refundBatches: new Map(),
  history: new Map()
};

const addHistory = (entityType, entityId, action, data, operator = 'system') => {
  const historyId = uuidv4();
  const record = {
    id: historyId,
    entityType,
    entityId,
    action,
    data,
    operator,
    createdAt: new Date().toISOString()
  };
  
  if (!database.history.has(entityId)) {
    database.history.set(entityId, []);
  }
  database.history.get(entityId).push(record);
  return record;
};

const createLease = (data) => {
  const id = uuidv4();
  const lease = {
    id,
    equipmentName: data.equipmentName,
    equipmentCode: data.equipmentCode,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    startDate: data.startDate,
    endDate: data.endDate,
    status: LEASE_STATUS.RENTING,
    depositAmount: Number(data.depositAmount),
    refundedAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  database.leases.set(id, lease);
  addHistory('lease', id, 'CREATE', { status: LEASE_STATUS.RENTING });
  return lease;
};

const createDeposit = (leaseId, amount) => {
  const id = uuidv4();
  const deposit = {
    id,
    leaseId,
    amount: Number(amount),
    remainingAmount: Number(amount),
    refundedAmount: 0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
  database.deposits.set(id, deposit);
  addHistory('deposit', id, 'CREATE', { amount });
  return deposit;
};

const createInspectionItem = (data) => {
  const id = uuidv4();
  const item = {
    id,
    leaseId: data.leaseId,
    itemName: data.itemName,
    itemType: data.itemType,
    status: 'PENDING',
    result: null,
    notes: null,
    checkedBy: null,
    checkedAt: null,
    createdAt: new Date().toISOString()
  };
  database.inspectionItems.set(id, item);
  addHistory('inspection', id, 'CREATE', { itemName: data.itemName });
  return item;
};

const createRefundBatch = (data) => {
  const id = uuidv4();
  const batch = {
    id,
    leaseId: data.leaseId,
    batchNo: `REF-${Date.now()}`,
    amount: Number(data.amount),
    status: REFUND_STATUS.PENDING,
    reason: data.reason || '',
    attachments: data.attachments || [],
    operator: data.operator || 'system',
    approvedBy: null,
    approvedAt: null,
    rejectedReason: null,
    nextStep: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  database.refundBatches.set(id, batch);
  addHistory('refund', id, 'CREATE', { amount: data.amount, status: REFUND_STATUS.PENDING });
  return batch;
};

module.exports = {
  LEASE_STATUS,
  REFUND_STATUS,
  database,
  addHistory,
  createLease,
  createDeposit,
  createInspectionItem,
  createRefundBatch
};
