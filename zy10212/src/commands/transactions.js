const { generateId, now, logSuccess, logError, logWarn } = require('../utils');
const store = require('../store');
const validator = require('../validator');

function createInventoryCheck(specId, physicalQty, operator) {
  const spec = store.getSpecById('pending', specId);
  if (!spec) {
    logError(`规格不存在: ${specId}`);
    return null;
  }

  const inventory = store.computeCurrentInventory('pending');
  const inv = inventory.find(i => i.specId === specId);
  const currentQty = inv ? inv.quantity : 0;
  const diff = physicalQty - currentQty;

  const transactions = store.getTransactions('pending');
  const newTransaction = {
    id: generateId('T'),
    type: 'inventory_check',
    specId,
    studentId: null,
    studentName: null,
    courseId: null,
    quantity: diff,
    reasonCode: diff > 0 ? 'INVENTORY_UP' : diff < 0 ? 'INVENTORY_DOWN' : 'NO_CHANGE',
    reasonText: `盘点调整: 账面${currentQty}${spec.unit}, 实盘${physicalQty}${spec.unit}, 差异${diff}${spec.unit}`,
    approvedBy: operator || 'operator',
    approvedAt: now(),
    status: 'pending',
    importedAt: now()
  };

  store.saveTransactions('pending', [...transactions, newTransaction]);
  logSuccess(`创建盘点记录: ${diff > 0 ? '+' : ''}${diff}${spec.unit} (ID: ${newTransaction.id})`);

  return newTransaction;
}

function createIssue(specId, studentId, studentName, quantity, courseId, options = {}) {
  const validation = validator.validateIssue('pending', specId, quantity);
  if (!validation.valid) {
    validation.errors.forEach(e => logError(e));
    return null;
  }

  const transactions = store.getTransactions('pending');
  const newTransaction = {
    id: generateId('T'),
    type: 'issue',
    specId,
    studentId,
    studentName: studentName || studentId,
    courseId: courseId || null,
    quantity: -quantity,
    reasonCode: options.reasonCode || 'ISSUE',
    reasonText: options.reasonText || '课程发放',
    approvedBy: options.approvedBy || null,
    approvedAt: options.approvedBy ? now() : null,
    status: 'pending',
    importedAt: now()
  };

  store.saveTransactions('pending', [...transactions, newTransaction]);
  logSuccess(`创建发放记录: -${quantity}${store.getSpecById('pending', specId).unit} (ID: ${newTransaction.id})`);

  return newTransaction;
}

function createRefund(specId, studentId, studentName, quantity, courseId, options = {}) {
  const validation = validator.validateRefund('pending', studentId, specId, quantity, courseId);
  if (!validation.valid) {
    validation.errors.forEach(e => logError(e));
    return null;
  }

  const transactions = store.getTransactions('pending');
  const newTransaction = {
    id: generateId('T'),
    type: 'refund',
    specId,
    studentId,
    studentName: studentName || studentId,
    courseId: courseId || null,
    quantity: quantity,
    reasonCode: options.reasonCode || 'REFUND',
    reasonText: options.reasonText || '退费回库',
    approvedBy: options.approvedBy || null,
    approvedAt: options.approvedBy ? now() : null,
    status: 'pending',
    importedAt: now()
  };

  store.saveTransactions('pending', [...transactions, newTransaction]);
  logSuccess(`创建退费记录: +${quantity}${store.getSpecById('pending', specId).unit} (ID: ${newTransaction.id})`);

  return newTransaction;
}

function createReissue(specId, studentId, studentName, quantity, options = {}) {
  const errors = [];

  if (!options.approvedBy) {
    errors.push('补发必须提供审批人 (--approved-by)');
  }
  if (!options.reasonText) {
    errors.push('补发必须提供原因 (--reason)');
  }

  if (errors.length > 0) {
    errors.forEach(e => logError(e));
    return null;
  }

  const spec = store.getSpecById('pending', specId);
  if (!spec) {
    logError(`规格不存在: ${specId}`);
    return null;
  }

  if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
    logError('补发数量必须是正整数');
    return null;
  }

  const transactions = store.getTransactions('pending');
  const newTransaction = {
    id: generateId('T'),
    type: 'reissue',
    specId,
    studentId,
    studentName: studentName || studentId,
    courseId: options.courseId || null,
    quantity: -quantity,
    reasonCode: options.reasonCode || 'REISSUE',
    reasonText: options.reasonText,
    approvedBy: options.approvedBy,
    approvedAt: now(),
    status: 'pending',
    importedAt: now()
  };

  store.saveTransactions('pending', [...transactions, newTransaction]);
  logSuccess(`创建补发记录: -${quantity}${spec.unit} (ID: ${newTransaction.id})`);

  return newTransaction;
}

function updateTransaction(transactionId, updates) {
  const transactions = store.getTransactions('pending');
  const idx = transactions.findIndex(t => t.id === transactionId);

  if (idx === -1) {
    logError(`交易不存在: ${transactionId}`);
    return null;
  }

  if (transactions[idx].status === 'confirmed') {
    logWarn('已确认的交易不能修改');
    return null;
  }

  const allowedFields = [
    'specId', 'studentId', 'studentName', 'courseId',
    'quantity', 'reasonCode', 'reasonText',
    'approvedBy', 'approvedAt'
  ];

  const newTransaction = { ...transactions[idx] };
  Object.entries(updates).forEach(([key, val]) => {
    if (allowedFields.includes(key)) {
      newTransaction[key] = val;
    }
  });

  transactions[idx] = newTransaction;
  store.saveTransactions('pending', transactions);
  logSuccess(`已更新交易: ${transactionId}`);

  return newTransaction;
}

function deleteTransaction(transactionId) {
  const transactions = store.getTransactions('pending');
  const idx = transactions.findIndex(t => t.id === transactionId);

  if (idx === -1) {
    logError(`交易不存在: ${transactionId}`);
    return false;
  }

  if (transactions[idx].status === 'confirmed') {
    logWarn('已确认的交易不能删除');
    return false;
  }

  const filtered = transactions.filter(t => t.id !== transactionId);
  store.saveTransactions('pending', filtered);
  logSuccess(`已删除交易: ${transactionId}`);

  return true;
}

function listTransactions(options = {}) {
  const transactions = store.getTransactions('pending');

  let filtered = transactions;
  if (options.type) {
    filtered = filtered.filter(t => t.type === options.type);
  }
  if (options.status) {
    filtered = filtered.filter(t => t.status === options.status);
  }
  if (options.specId) {
    filtered = filtered.filter(t => t.specId === options.specId);
  }
  if (options.studentId) {
    filtered = filtered.filter(
      t => t.studentId === options.studentId || t.studentName === options.studentId
    );
  }

  return filtered;
}

module.exports = {
  createInventoryCheck,
  createIssue,
  createRefund,
  createReissue,
  updateTransaction,
  deleteTransaction,
  listTransactions
};
