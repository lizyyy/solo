const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('./database');

const STATUS = {
  PENDING_PUBLISH: '待发布',
  IN_GRAY: '灰度中',
  PAUSED: '暂停',
  ROLLBACK_COMPLETE: '回滚完成',
  RECALLED: '已撤回',
  REJECTED: '已拒绝'
};

const REQUEST_TYPE = {
  UPGRADE: '升级',
  ROLLBACK: '回滚'
};

function validateApprovalData(data) {
  const errors = [];
  
  if (!data.device_model) {
    errors.push('device_model 不能为空');
  }
  if (!data.firmware_version) {
    errors.push('firmware_version 不能为空');
  }
  if (!data.gray_batch) {
    errors.push('gray_batch 不能为空');
  }
  if (!data.fault_samples) {
    errors.push('fault_samples 不能为空');
  }
  if (!data.device_group) {
    errors.push('device_group 不能为空');
  }
  if (!data.request_type || !REQUEST_TYPE[data.request_type.toUpperCase()]) {
    errors.push('request_type 必须是 "升级" 或 "回滚"');
  }
  if (!data.applicant) {
    errors.push('applicant 不能为空');
  }
  
  return errors;
}

async function checkConflict(deviceGroup, requestType, excludeId = null) {
  const oppositeType = requestType === '升级' ? '回滚' : '升级';
  const activeStatuses = [STATUS.PENDING_PUBLISH, STATUS.IN_GRAY];
  
  let sql = `
    SELECT id, device_model, firmware_version, gray_batch, status, request_type
    FROM approvals 
    WHERE device_group = ? 
    AND request_type = ? 
    AND status IN (${activeStatuses.map(() => '?').join(',')})
  `;
  
  const params = [deviceGroup, oppositeType, ...activeStatuses];
  
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  
  const conflicts = await allQuery(sql, params);
  return conflicts;
}

async function createApproval(data) {
  const validationErrors = validateApprovalData(data);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: '数据验证失败',
      details: validationErrors,
      code: 400
    };
  }

  const existing = await getQuery(
    `SELECT id, status FROM approvals 
     WHERE device_model = ? AND firmware_version = ? AND gray_batch = ? AND status IN (?, ?)`,
    [data.device_model, data.firmware_version, data.gray_batch, STATUS.PENDING_PUBLISH, STATUS.IN_GRAY]
  );

  if (existing) {
    return {
      success: false,
      error: 'DUPLICATE_REQUEST',
      message: '该灰度批次已有进行中的审批单',
      existingId: existing.id,
      code: 409
    };
  }

  const conflicts = await checkConflict(data.device_group, data.request_type);
  if (conflicts.length > 0) {
    return {
      success: false,
      error: 'CONFLICT_DETECTED',
      message: '同一设备组存在相反类型的活跃审批，需要人工介入',
      conflicts: conflicts,
      code: 409
    };
  }

  const id = uuidv4();
  const now = Date.now();
  const status = STATUS.PENDING_PUBLISH;

  await runQuery(
    `INSERT INTO approvals (
      id, device_model, firmware_version, gray_batch, fault_samples, 
      device_group, status, request_type, reason, applicant, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.device_model, data.firmware_version, data.gray_batch,
      JSON.stringify(data.fault_samples), data.device_group, status,
      data.request_type, data.reason || '', data.applicant, now, now
    ]
  );

  await addHistory(id, status, data.applicant, '创建审批单', null);

  return {
    success: true,
    data: { id, status }
  };
}

async function updateStatus(id, newStatus, operator, comment = '') {
  const approval = await getQuery('SELECT * FROM approvals WHERE id = ?', [id]);
  
  if (!approval) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: '审批单不存在',
      code: 404
    };
  }

  if (!Object.values(STATUS).includes(newStatus)) {
    return {
      success: false,
      error: 'INVALID_STATUS',
      message: '无效的状态值',
      code: 400
    };
  }

  const now = Date.now();
  
  await runQuery(
    'UPDATE approvals SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, now, id]
  );

  await addHistory(id, newStatus, operator, comment, null);

  return {
    success: true,
    data: { id, status: newStatus }
  };
}

async function recallApproval(id, operator, comment = '') {
  const approval = await getQuery('SELECT * FROM approvals WHERE id = ?', [id]);
  
  if (!approval) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: '审批单不存在',
      code: 404
    };
  }

  if (approval.status !== STATUS.PENDING_PUBLISH) {
    return {
      success: false,
      error: 'INVALID_STATE',
      message: '只有待发布状态的审批单可以撤回',
      code: 400
    };
  }

  return updateStatus(id, STATUS.RECALLED, operator, comment || '撤回审批单');
}

async function resubmitApproval(id, data, operator) {
  const approval = await getQuery('SELECT * FROM approvals WHERE id = ?', [id]);
  
  if (!approval) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: '审批单不存在',
      code: 404
    };
  }

  if (approval.status !== STATUS.RECALLED) {
    return {
      success: false,
      error: 'INVALID_STATE',
      message: '只有已撤回状态的审批单可以重新提交',
      code: 400
    };
  }

  const validationErrors = validateApprovalData(data);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: '数据验证失败',
      details: validationErrors,
      code: 400
    };
  }

  const conflicts = await checkConflict(data.device_group, data.request_type, id);
  if (conflicts.length > 0) {
    return {
      success: false,
      error: 'CONFLICT_DETECTED',
      message: '同一设备组存在相反类型的活跃审批，需要人工介入',
      conflicts: conflicts,
      code: 409
    };
  }

  const now = Date.now();
  const newStatus = STATUS.PENDING_PUBLISH;
  const changedFields = [];

  if (data.device_model !== approval.device_model) changedFields.push('device_model');
  if (data.firmware_version !== approval.firmware_version) changedFields.push('firmware_version');
  if (data.gray_batch !== approval.gray_batch) changedFields.push('gray_batch');
  if (JSON.stringify(data.fault_samples) !== approval.fault_samples) changedFields.push('fault_samples');

  await runQuery(
    `UPDATE approvals SET 
      device_model = ?, firmware_version = ?, gray_batch = ?, fault_samples = ?,
      device_group = ?, status = ?, request_type = ?, reason = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.device_model, data.firmware_version, data.gray_batch,
      JSON.stringify(data.fault_samples), data.device_group, newStatus,
      data.request_type, data.reason || '', now, id
    ]
  );

  await addHistory(id, newStatus, operator, '重新提交审批单', changedFields);

  return {
    success: true,
    data: { id, status: newStatus }
  };
}

async function addHistory(approvalId, status, operator, comment, changedFields) {
  const now = Date.now();
  await runQuery(
    `INSERT INTO approval_history (approval_id, status, operator, comment, changed_fields, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [approvalId, status, operator, comment, changedFields ? JSON.stringify(changedFields) : null, now]
  );
}

async function getApproval(id) {
  const approval = await getQuery('SELECT * FROM approvals WHERE id = ?', [id]);
  
  if (!approval) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: '审批单不存在',
      code: 404
    };
  }

  approval.fault_samples = JSON.parse(approval.fault_samples);
  
  const history = await allQuery(
    'SELECT * FROM approval_history WHERE approval_id = ? ORDER BY created_at DESC',
    [id]
  );

  history.forEach(h => {
    if (h.changed_fields) {
      h.changed_fields = JSON.parse(h.changed_fields);
    }
  });

  return {
    success: true,
    data: {
      ...approval,
      history
    }
  };
}

async function listApprovals(filters = {}) {
  let sql = 'SELECT * FROM approvals WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.device_group) {
    sql += ' AND device_group = ?';
    params.push(filters.device_group);
  }
  if (filters.device_model) {
    sql += ' AND device_model = ?';
    params.push(filters.device_model);
  }

  sql += ' ORDER BY created_at DESC';

  const approvals = await allQuery(sql, params);
  
  approvals.forEach(a => {
    a.fault_samples = JSON.parse(a.fault_samples);
  });

  return {
    success: true,
    data: approvals
  };
}

async function getHistory(id) {
  const history = await allQuery(
    'SELECT * FROM approval_history WHERE approval_id = ? ORDER BY created_at DESC',
    [id]
  );

  history.forEach(h => {
    if (h.changed_fields) {
      h.changed_fields = JSON.parse(h.changed_fields);
    }
  });

  return {
    success: true,
    data: history
  };
}

async function exportApprovals(filters = {}) {
  const result = await listApprovals(filters);
  if (!result.success) {
    return result;
  }

  const exportData = result.data.map(a => ({
    id: a.id,
    device_model: a.device_model,
    firmware_version: a.firmware_version,
    gray_batch: a.gray_batch,
    fault_samples: Array.isArray(a.fault_samples) ? a.fault_samples.join(';') : a.fault_samples,
    device_group: a.device_group,
    status: a.status,
    request_type: a.request_type,
    reason: a.reason,
    applicant: a.applicant,
    created_at: new Date(a.created_at).toISOString(),
    updated_at: new Date(a.updated_at).toISOString()
  }));

  return {
    success: true,
    data: exportData
  };
}

module.exports = {
  STATUS,
  REQUEST_TYPE,
  createApproval,
  updateStatus,
  recallApproval,
  resubmitApproval,
  getApproval,
  listApprovals,
  getHistory,
  exportApprovals
};
