const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../database');

const {
  getDb,
  getMaxValidityDays,
  isValidPermissionType,
  PERMISSION_STATUS,
  EXTENSION_STATUS
} = db;

function logAudit(action, actor, details, permissionId = null) {
  const dbInstance = getDb();
  const stmt = dbInstance.prepare(`
    INSERT INTO audit_logs (id, permission_id, action, actor, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    uuidv4(),
    permissionId,
    action,
    actor,
    typeof details === 'string' ? details : JSON.stringify(details),
    new Date().toISOString()
  );
}

function createPermission(data) {
  const {
    applicant,
    permissionType,
    reason,
    requestedDays,
    validFrom = new Date().toISOString()
  } = data;
  
  if (!applicant || !permissionType || !reason || !requestedDays) {
    throw new Error('缺少必需参数: applicant, permissionType, reason, requestedDays');
  }
  
  if (!isValidPermissionType(permissionType)) {
    throw new Error(`无效的权限类型: ${permissionType}`);
  }
  
  const maxValidityDays = getMaxValidityDays(permissionType);
  if (requestedDays > maxValidityDays) {
    throw new Error(`${permissionType} 权限的最大有效期为 ${maxValidityDays} 天`);
  }
  
  if (requestedDays <= 0) {
    throw new Error('请求的天数必须大于0');
  }
  
  const validFromMoment = moment(validFrom);
  const validTo = validFromMoment.clone().add(requestedDays, 'days').toISOString();
  
  const dbInstance = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = dbInstance.prepare(`
    INSERT INTO permissions (
      id, applicant, permission_type, reason, requested_days,
      valid_from, valid_to, status, created_at, updated_at,
      original_valid_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    applicant,
    permissionType,
    reason,
    requestedDays,
    validFromMoment.toISOString(),
    validTo,
    PERMISSION_STATUS.PENDING,
    now,
    now,
    validTo
  );
  
  logAudit('CREATE_PERMISSION', 'system', {
    applicant,
    permissionType,
    reason,
    requestedDays
  }, id);
  
  return getPermission(id);
}

function getPermission(id) {
  const dbInstance = getDb();
  const stmt = dbInstance.prepare(`
    SELECT * FROM permissions WHERE id = ?
  `);
  
  return stmt.get(id);
}

function listPermissions(filters = {}) {
  const dbInstance = getDb();
  let query = 'SELECT * FROM permissions WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.applicant) {
    query += ' AND applicant = ?';
    params.push(filters.applicant);
  }
  
  if (filters.permissionType) {
    query += ' AND permission_type = ?';
    params.push(filters.permissionType);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return dbInstance.prepare(query).all(...params);
}

function approvePermission(data) {
  const {
    permissionId,
    approver,
    comment = ''
  } = data;
  
  if (!permissionId || !approver) {
    throw new Error('缺少必需参数: permissionId, approver');
  }
  
  const permission = getPermission(permissionId);
  if (!permission) {
    throw new Error(`权限不存在: ${permissionId}`);
  }
  
  if (permission.status !== PERMISSION_STATUS.PENDING) {
    throw new Error(`权限 ${permissionId} 状态为 ${permission.status}，无法审批`);
  }
  
  const dbInstance = getDb();
  const approvalId = uuidv4();
  const now = new Date().toISOString();
  
  const tx = dbInstance.transaction(() => {
    const approvalStmt = dbInstance.prepare(`
      INSERT INTO approvals (id, permission_id, approver, decision, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    approvalStmt.run(
      approvalId,
      permissionId,
      approver,
      'approved',
      comment,
      now
    );
    
    const updateStmt = dbInstance.prepare(`
      UPDATE permissions 
      SET status = ?, approval_id = ?, updated_at = ?
      WHERE id = ?
    `);
    
    updateStmt.run(
      PERMISSION_STATUS.APPROVED,
      approvalId,
      now,
      permissionId
    );
  });
  
  tx();
  
  logAudit('APPROVE_PERMISSION', approver, {
    comment,
    approvalId
  }, permissionId);
  
  return getPermission(permissionId);
}

function rejectPermission(data) {
  const {
    permissionId,
    approver,
    comment = ''
  } = data;
  
  if (!permissionId || !approver) {
    throw new Error('缺少必需参数: permissionId, approver');
  }
  
  const permission = getPermission(permissionId);
  if (!permission) {
    throw new Error(`权限不存在: ${permissionId}`);
  }
  
  if (permission.status !== PERMISSION_STATUS.PENDING) {
    throw new Error(`权限 ${permissionId} 状态为 ${permission.status}，无法审批`);
  }
  
  const dbInstance = getDb();
  const approvalId = uuidv4();
  const now = new Date().toISOString();
  
  const tx = dbInstance.transaction(() => {
    const approvalStmt = dbInstance.prepare(`
      INSERT INTO approvals (id, permission_id, approver, decision, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    approvalStmt.run(
      approvalId,
      permissionId,
      approver,
      'rejected',
      comment,
      now
    );
    
    const updateStmt = dbInstance.prepare(`
      UPDATE permissions 
      SET status = ?, approval_id = ?, updated_at = ?
      WHERE id = ?
    `);
    
    updateStmt.run(
      PERMISSION_STATUS.REJECTED,
      approvalId,
      now,
      permissionId
    );
  });
  
  tx();
  
  logAudit('REJECT_PERMISSION', approver, {
    comment,
    approvalId
  }, permissionId);
  
  return getPermission(permissionId);
}

function authorizePermission(data) {
  const {
    permissionId,
    authorizer
  } = data;
  
  if (!permissionId || !authorizer) {
    throw new Error('缺少必需参数: permissionId, authorizer');
  }
  
  const permission = getPermission(permissionId);
  if (!permission) {
    throw new Error(`权限不存在: ${permissionId}`);
  }
  
  if (permission.status !== PERMISSION_STATUS.APPROVED) {
    throw new Error(`权限 ${permissionId} 状态为 ${permission.status}，需要先审批通过`);
  }
  
  const dbInstance = getDb();
  const now = new Date().toISOString();
  
  const updateStmt = dbInstance.prepare(`
    UPDATE permissions 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  
  updateStmt.run(
    PERMISSION_STATUS.AUTHORIZED,
    now,
    permissionId
  );
  
  logAudit('AUTHORIZE_PERMISSION', authorizer, {}, permissionId);
  
  return getPermission(permissionId);
}

function listExpiringPermissions(days = 3) {
  const dbInstance = getDb();
  const cutoffTime = moment().add(days, 'days').toISOString();
  const now = new Date().toISOString();
  
  return dbInstance.prepare(`
    SELECT * FROM permissions 
    WHERE status = ? 
    AND valid_to <= ?
    AND valid_to > ?
    ORDER BY valid_to ASC
  `).all(PERMISSION_STATUS.AUTHORIZED, cutoffTime, now);
}

function listExpiredPermissions() {
  const dbInstance = getDb();
  const now = new Date().toISOString();
  
  return dbInstance.prepare(`
    SELECT * FROM permissions 
    WHERE status = ? 
    AND valid_to <= ?
    ORDER BY valid_to ASC
  `).all(PERMISSION_STATUS.AUTHORIZED, now);
}

function revokePermission(permissionId, revoker, reason = '权限到期') {
  const permission = getPermission(permissionId);
  if (!permission) {
    throw new Error(`权限不存在: ${permissionId}`);
  }
  
  if (permission.status === PERMISSION_STATUS.REVOKED) {
    throw new Error(`权限 ${permissionId} 已被回收，不能重复回收`);
  }
  
  if (permission.status !== PERMISSION_STATUS.AUTHORIZED && 
      permission.status !== PERMISSION_STATUS.REVOKE_FAILED) {
    throw new Error(`权限 ${permissionId} 状态为 ${permission.status}，无法回收`);
  }
  
  const dbInstance = getDb();
  const now = new Date().toISOString();
  
  const updateStmt = dbInstance.prepare(`
    UPDATE permissions 
    SET status = ?, updated_at = ?, notes = ?
    WHERE id = ?
  `);
  
  updateStmt.run(
    PERMISSION_STATUS.REVOKED,
    now,
    reason,
    permissionId
  );
  
  logAudit('REVOKE_PERMISSION', revoker, { reason }, permissionId);
  
  return getPermission(permissionId);
}

function createRevokeTask(permissionId, reason) {
  const dbInstance = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = dbInstance.prepare(`
    INSERT INTO revoke_tasks (id, permission_id, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    permissionId,
    reason,
    'pending',
    now
  );
  
  logAudit('CREATE_REVOKE_TASK', 'system', { reason, taskId: id }, permissionId);
  
  return getRevokeTask(id);
}

function getRevokeTask(taskId) {
  const dbInstance = getDb();
  return dbInstance.prepare('SELECT * FROM revoke_tasks WHERE id = ?').get(taskId);
}

function scanAndRevokeExpired() {
  const expiredPermissions = listExpiredPermissions();
  const results = {
    total: expiredPermissions.length,
    success: 0,
    failed: 0,
    details: []
  };
  
  for (const permission of expiredPermissions) {
    if (permission.last_revoke_attempt) {
      results.details.push({
        id: permission.id,
        status: 'skipped',
        reason: '上次回收失败，已在人工处理队列中'
      });
      continue;
    }
    
    try {
      const success = simulateExternalRevoke(permission.id);
      
      if (success) {
        revokePermission(permission.id, 'system', '自动回收-权限到期');
        results.success++;
        results.details.push({
          id: permission.id,
          applicant: permission.applicant,
          permissionType: permission.permission_type,
          status: 'revoked'
        });
      } else {
        const dbInstance = getDb();
        const now = new Date().toISOString();
        
        const updateStmt = dbInstance.prepare(`
          UPDATE permissions 
          SET status = ?, updated_at = ?, last_revoke_attempt = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          PERMISSION_STATUS.REVOKE_FAILED,
          now,
          now,
          permission.id
        );
        
        createRevokeTask(permission.id, '外部系统回收失败');
        results.failed++;
        results.details.push({
          id: permission.id,
          applicant: permission.applicant,
          permissionType: permission.permission_type,
          status: 'revoke_failed',
          message: '已创建人工处理任务'
        });
        
        logAudit('REVOKE_FAILED', 'system', {
          message: '外部系统回收失败'
        }, permission.id);
      }
    } catch (error) {
      results.failed++;
      results.details.push({
        id: permission.id,
        status: 'error',
        message: error.message
      });
    }
  }
  
  return results;
}

function simulateExternalRevoke(permissionId) {
  return Math.random() > 0.1;
}

function requestExtension(data) {
  const {
    permissionId,
    applicant,
    additionalDays,
    reason
  } = data;
  
  if (!permissionId || !applicant || !additionalDays || !reason) {
    throw new Error('缺少必需参数: permissionId, applicant, additionalDays, reason');
  }
  
  const permission = getPermission(permissionId);
  if (!permission) {
    throw new Error(`权限不存在: ${permissionId}`);
  }
  
  if (permission.status !== PERMISSION_STATUS.AUTHORIZED) {
    throw new Error(`权限 ${permissionId} 状态为 ${permission.status}，只有已授权的权限才能申请延期`);
  }
  
  const currentValidTo = moment(permission.valid_to);
  const daysUntilExpiry = currentValidTo.diff(moment(), 'days');
  
  if (daysUntilExpiry < 0) {
    throw new Error(`权限 ${permissionId} 已过期，不能申请延期`);
  }
  
  const maxValidityDays = getMaxValidityDays(permission.permission_type);
  const totalRequested = permission.requested_days + (permission.extension_count * maxValidityDays) + additionalDays;
  
  if (totalRequested > maxValidityDays * 2) {
    throw new Error(`延期后总有效期不能超过最大有效期的2倍 (${maxValidityDays * 2} 天)`);
  }
  
  if (additionalDays > maxValidityDays) {
    throw new Error(`单次延期不能超过最大有效期 ${maxValidityDays} 天`);
  }
  
  const dbInstance = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const newValidTo = currentValidTo.clone().add(additionalDays, 'days').toISOString();
  
  const stmt = dbInstance.prepare(`
    INSERT INTO extensions (
      id, permission_id, applicant, additional_days, reason,
      status, original_valid_to, new_valid_to, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    permissionId,
    applicant,
    additionalDays,
    reason,
    EXTENSION_STATUS.PENDING,
    permission.valid_to,
    newValidTo,
    now,
    now
  );
  
  logAudit('REQUEST_EXTENSION', applicant, {
    additionalDays,
    reason,
    currentValidTo: permission.valid_to
  }, permissionId);
  
  return getExtension(id);
}

function getExtension(id) {
  const dbInstance = getDb();
  return dbInstance.prepare('SELECT * FROM extensions WHERE id = ?').get(id);
}

function approveExtension(data) {
  const {
    extensionId,
    approver,
    comment = ''
  } = data;
  
  if (!extensionId || !approver) {
    throw new Error('缺少必需参数: extensionId, approver');
  }
  
  const extension = getExtension(extensionId);
  if (!extension) {
    throw new Error(`延期申请不存在: ${extensionId}`);
  }
  
  if (extension.status !== EXTENSION_STATUS.PENDING) {
    throw new Error(`延期申请 ${extensionId} 状态为 ${extension.status}，无法审批`);
  }
  
  const permission = getPermission(extension.permission_id);
  if (!permission) {
    throw new Error(`关联的权限不存在: ${extension.permission_id}`);
  }
  
  const dbInstance = getDb();
  const now = new Date().toISOString();
  
  const tx = dbInstance.transaction(() => {
    const approvalId = uuidv4();
    
    const approvalStmt = dbInstance.prepare(`
      INSERT INTO approvals (id, permission_id, approver, decision, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    approvalStmt.run(
      approvalId,
      extension.permission_id,
      approver,
      'approved_extension',
      comment,
      now
    );
    
    const updateExtensionStmt = dbInstance.prepare(`
      UPDATE extensions 
      SET status = ?, approval_id = ?, updated_at = ?
      WHERE id = ?
    `);
    
    updateExtensionStmt.run(
      EXTENSION_STATUS.APPROVED,
      approvalId,
      now,
      extensionId
    );
    
    const updatePermissionStmt = dbInstance.prepare(`
      UPDATE permissions 
      SET valid_to = ?, extension_count = extension_count + 1, updated_at = ?
      WHERE id = ?
    `);
    
    updatePermissionStmt.run(
      extension.new_valid_to,
      now,
      extension.permission_id
    );
  });
  
  tx();
  
  logAudit('APPROVE_EXTENSION', approver, {
    extensionId,
    newValidTo: extension.new_valid_to,
    additionalDays: extension.additional_days
  }, extension.permission_id);
  
  return getExtension(extensionId);
}

function rejectExtension(data) {
  const {
    extensionId,
    approver,
    comment = ''
  } = data;
  
  if (!extensionId || !approver) {
    throw new Error('缺少必需参数: extensionId, approver');
  }
  
  const extension = getExtension(extensionId);
  if (!extension) {
    throw new Error(`延期申请不存在: ${extensionId}`);
  }
  
  if (extension.status !== EXTENSION_STATUS.PENDING) {
    throw new Error(`延期申请 ${extensionId} 状态为 ${extension.status}，无法审批`);
  }
  
  const dbInstance = getDb();
  const now = new Date().toISOString();
  
  const tx = dbInstance.transaction(() => {
    const approvalId = uuidv4();
    
    const approvalStmt = dbInstance.prepare(`
      INSERT INTO approvals (id, permission_id, approver, decision, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    approvalStmt.run(
      approvalId,
      extension.permission_id,
      approver,
      'rejected_extension',
      comment,
      now
    );
    
    const updateExtensionStmt = dbInstance.prepare(`
      UPDATE extensions 
      SET status = ?, approval_id = ?, updated_at = ?
      WHERE id = ?
    `);
    
    updateExtensionStmt.run(
      EXTENSION_STATUS.REJECTED,
      approvalId,
      now,
      extensionId
    );
  });
  
  tx();
  
  logAudit('REJECT_EXTENSION', approver, {
    extensionId,
    comment
  }, extension.permission_id);
  
  return getExtension(extensionId);
}

function listRevokeRecords() {
  const dbInstance = getDb();
  
  return dbInstance.prepare(`
    SELECT 
      p.*,
      rt.id as task_id,
      rt.reason as task_reason,
      rt.status as task_status
    FROM permissions p
    LEFT JOIN revoke_tasks rt ON rt.permission_id = p.id
    WHERE p.status IN (?, ?)
    ORDER BY p.updated_at DESC
  `).all(PERMISSION_STATUS.REVOKED, PERMISSION_STATUS.REVOKE_FAILED);
}

function listPendingRevokeTasks() {
  const dbInstance = getDb();
  
  return dbInstance.prepare(`
    SELECT 
      rt.*,
      p.applicant,
      p.permission_type,
      p.valid_to
    FROM revoke_tasks rt
    JOIN permissions p ON p.id = rt.permission_id
    WHERE rt.status = ?
    ORDER BY rt.created_at ASC
  `).all('pending');
}

function getScanSummary() {
  const dbInstance = getDb();
  
  const byType = dbInstance.prepare(`
    SELECT 
      permission_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'authorized' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked,
      SUM(CASE WHEN status = 'revoke_failed' THEN 1 ELSE 0 END) as revoke_failed,
      SUM(CASE WHEN status = 'authorized' AND valid_to <= datetime('now', '+3 day') THEN 1 ELSE 0 END) as expiring
    FROM permissions
    GROUP BY permission_type
  `).all();
  
  const byApplicant = dbInstance.prepare(`
    SELECT 
      applicant,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'authorized' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
    FROM permissions
    GROUP BY applicant
    ORDER BY active DESC
  `).all();
  
  const tasks = listPendingRevokeTasks();
  
  return {
    byType,
    byApplicant,
    pendingRevokeTasks: tasks,
    generatedAt: new Date().toISOString()
  };
}

function getAuditReport(filters = {}) {
  const dbInstance = getDb();
  let query = `
    SELECT 
      al.*,
      p.applicant,
      p.permission_type
    FROM audit_logs al
    LEFT JOIN permissions p ON p.id = al.permission_id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.permissionId) {
    query += ' AND al.permission_id = ?';
    params.push(filters.permissionId);
  }
  
  if (filters.action) {
    query += ' AND al.action = ?';
    params.push(filters.action);
  }
  
  query += ' ORDER BY al.created_at DESC';
  
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return dbInstance.prepare(query).all(...params);
}

function checkPermissionAccess(permissionId) {
  const permission = getPermission(permissionId);
  if (!permission) {
    return {
      allowed: false,
      reason: '权限不存在'
    };
  }
  
  if (permission.status !== PERMISSION_STATUS.AUTHORIZED) {
    return {
      allowed: false,
      reason: `权限状态为 ${permission.status}，无法使用`
    };
  }
  
  const now = moment();
  const validFrom = moment(permission.valid_from);
  const validTo = moment(permission.valid_to);
  
  if (now.isBefore(validFrom)) {
    return {
      allowed: false,
      reason: '权限尚未生效'
    };
  }
  
  if (now.isAfter(validTo)) {
    return {
      allowed: false,
      reason: '权限已过期，等待自动回收'
    };
  }
  
  return {
    allowed: true,
    permission
  };
}

module.exports = {
  createPermission,
  getPermission,
  listPermissions,
  approvePermission,
  rejectPermission,
  authorizePermission,
  listExpiringPermissions,
  listExpiredPermissions,
  revokePermission,
  scanAndRevokeExpired,
  requestExtension,
  getExtension,
  approveExtension,
  rejectExtension,
  listRevokeRecords,
  listPendingRevokeTasks,
  getScanSummary,
  getAuditReport,
  checkPermissionAccess,
  logAudit
};
