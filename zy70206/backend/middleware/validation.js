const { db, STATUS_TRANSITIONS } = require('../models/database');

function validateRequiredFields(fields, required) {
  const errors = [];
  required.forEach(field => {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      errors.push({ field, message: `${field} 为必填字段` });
    }
  });
  return errors;
}

function validateQuantity(value, min = 0, max = Infinity) {
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, message: '数量必须是数字' };
  if (num <= min) return { valid: false, message: `数量必须大于 ${min}` };
  if (num > max) return { valid: false, message: `数量不能超过 ${max}` };
  return { valid: true, value: num };
}

function checkStatusTransition(fromStatus, toStatus) {
  const allowed = STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function checkDuplicateBatch(chemicalId, batchNo, excludeId = null) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM chemical_batches WHERE chemical_id = ? AND batch_no = ?';
    const params = [chemicalId, batchNo];
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      resolve(row ? true : false);
    });
  });
}

function checkBatchAvailability(batchId, requiredQuantity) {
  return new Promise((resolve, reject) => {
    db.get('SELECT available_quantity FROM chemical_batches WHERE id = ?', [batchId], (err, row) => {
      if (err) reject(err);
      if (!row) resolve({ available: false, reason: '批号不存在' });
      else if (row.available_quantity < requiredQuantity)
        resolve({ available: false, reason: `库存不足，当前可用：${row.available_quantity}` });
      else resolve({ available: true });
    });
  });
}

function getNextSteps(status, data = {}) {
  const steps = {
    DRAFT: [
      { action: 'submit', label: '提交申请', description: '确认信息无误后提交给导师审批' },
      { action: 'edit', label: '完善信息', description: '检查并补充必填字段' }
    ],
    PENDING_APPROVAL: [
      { action: 'wait', label: '等待导师审批', description: '申请已提交，等待导师审核' }
    ],
    APPROVED: [
      { action: 'outbound', label: '办理出库', description: '凭审批单到库房领取危化品' }
    ],
    REJECTED: [
      { action: 'revise', label: '修改后重新提交', description: '根据拒绝原因修改申请内容' }
    ],
    OUTBOUND: [
      { action: 'return', label: '登记回收', description: '实验完成后登记剩余危化品回收量' }
    ],
    PARTIAL_RETURN: [
      { action: 'return', label: '继续回收登记', description: '还有未回收的危化品，请继续登记' }
    ],
    FULL_RETURN: [
      { action: 'close', label: '确认闭环', description: '确认所有危化品已回收，关闭申请' }
    ],
    CLOSED: [
      { action: 'archive', label: '归档完成', description: '该申请已完整闭环并归档' }
    ]
  };
  return steps[status] || [];
}

function getStatusWarning(status, data = {}) {
  const warnings = [];
  
  if (status === 'PENDING_APPROVAL' && !data.advisor_id) {
    warnings.push({ type: 'critical', message: '未选择审批导师，无法进入审批流程' });
  }
  
  if (status === 'OUTBOUND') {
    const returnRatio = data.returned_quantity && data.approved_quantity 
      ? data.returned_quantity / data.approved_quantity 
      : 0;
    if (returnRatio < 0.3 && data.approved_quantity > 500) {
      warnings.push({ type: 'warning', message: `回收比例较低 (${Math.round(returnRatio * 100)}%)，请确认是否有泄漏或损耗` });
    }
  }
  
  return warnings;
}

module.exports = {
  validateRequiredFields,
  validateQuantity,
  checkStatusTransition,
  checkDuplicateBatch,
  checkBatchAvailability,
  getNextSteps,
  getStatusWarning
};
