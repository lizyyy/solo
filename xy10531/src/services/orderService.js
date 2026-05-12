const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../config/store');
const { ORDER_STATUS } = require('../config/constants');

function recordStatusHistory(orderId, fromStatus, toStatus, reason, details, changedBy = 'system') {
  store.insert('status_history', {
    id: uuidv4(),
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    changed_by: changedBy,
    reason: reason || null,
    details: details ? JSON.stringify(details) : null
  });
}

function updateOrderStatus(orderId, newStatus, reason, details, changedBy = 'system') {
  const order = store.findOne('orders', o => o.id === orderId);
  if (!order) return null;
  
  const oldStatus = order.status;
  
  store.update('orders', o => o.id === orderId, {
    status: newStatus,
    updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  });
  
  recordStatusHistory(orderId, oldStatus, newStatus, reason, details, changedBy);
  
  return { oldStatus, newStatus };
}

function recordCheckpoint(orderId, checkpointType, status, passed, details = {}, idempotentKey = null, executedBy = 'system') {
  if (idempotentKey) {
    const existing = store.findOne('checkpoints', c => c.idempotent_key === idempotentKey);
    if (existing) {
      return { isDuplicate: true, checkpoint: existing };
    }
  }
  
  const checkpointNo = `CP-${dayjs().format('YYYYMMDDHHmmss')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  const checkpoint = store.insert('checkpoints', {
    id: uuidv4(),
    order_id: orderId,
    checkpoint_type: checkpointType,
    checkpoint_no: checkpointNo,
    status: status,
    passed: passed ? 1 : 0,
    error_code: details.errorCode || null,
    error_message: details.errorMessage || null,
    details: Object.keys(details).length > 0 ? JSON.stringify(details) : null,
    executed_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    executed_by: executedBy,
    idempotent_key: idempotentKey
  });
  
  return { isDuplicate: false, checkpointNo };
}

function getOrderByNo(orderNo) {
  return store.findOne('orders', o => o.order_no === orderNo);
}

function getOrderById(orderId) {
  return store.findOne('orders', o => o.id === orderId);
}

function getOrderItems(orderId) {
  return store.findMany('order_items', i => i.order_id === orderId);
}

function getOrderDocuments(orderId) {
  return store.findMany('documents', d => d.order_id === orderId);
}

function getOrderCheckpoints(orderId) {
  return store.findMany('checkpoints', c => c.order_id === orderId)
    .sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at));
}

function getOrderSupplements(orderId) {
  return store.findMany('supplements', s => s.order_id === orderId)
    .sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at));
}

function getOrderStatusHistory(orderId) {
  return store.findMany('status_history', h => h.order_id === orderId)
    .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
}

function getOrderManualCorrections(orderId) {
  return store.findMany('manual_corrections', c => c.order_id === orderId)
    .sort((a, b) => new Date(a.corrected_at) - new Date(b.corrected_at));
}

function recordManualCorrection(orderId, fieldName, oldValue, newValue, correctedBy, reason) {
  store.insert('manual_corrections', {
    id: uuidv4(),
    order_id: orderId,
    field_name: fieldName,
    old_value: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
    new_value: String(newValue),
    corrected_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    corrected_by: correctedBy,
    correction_reason: reason || null
  });
}

module.exports = {
  recordStatusHistory,
  updateOrderStatus,
  recordCheckpoint,
  getOrderByNo,
  getOrderById,
  getOrderItems,
  getOrderDocuments,
  getOrderCheckpoints,
  getOrderSupplements,
  getOrderStatusHistory,
  getOrderManualCorrections,
  recordManualCorrection
};
