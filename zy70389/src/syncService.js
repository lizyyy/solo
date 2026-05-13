const db = require('./db');
const { v4: uuidv4 } = require('uuid');

function createBatch(source) {
  const batchId = uuidv4();
  db.prepare(`INSERT INTO sync_batches (id, source, status) VALUES (?, ?, 'pending')`).run(batchId, source);
  return batchId;
}

function addSyncRecord(batchId, recordType, action, entityType, entityId) {
  const result = db.prepare(`
    INSERT INTO sync_records (batch_id, record_type, action, entity_type, entity_id, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(batchId, recordType, action, entityType, entityId);
  return result.lastInsertRowid;
}

function updateRecordStatus(recordId, status, errorMessage = null) {
  if (errorMessage) {
    db.prepare(`UPDATE sync_records SET status = ?, error_message = ? WHERE id = ?`).run(status, errorMessage, recordId);
  } else {
    db.prepare(`UPDATE sync_records SET status = ? WHERE id = ?`).run(status, recordId);
  }
}

function logRevocation(batchId, employeeId, roleId, roleName, reason) {
  db.prepare(`
    INSERT INTO permission_revocation_logs (batch_id, employee_id, role_id, role_name, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(batchId, employeeId, roleId, roleName, reason);
}

function isRevokedInBatch(batchId, employeeId, roleId) {
  const row = db.prepare(`
    SELECT 1 FROM permission_revocation_logs 
    WHERE batch_id = ? AND employee_id = ? AND role_id = ?
  `).get(batchId, employeeId, roleId);
  return !!row;
}

function addConflict(batchId, recordId, conflictType, description) {
  db.prepare(`
    INSERT INTO sync_conflicts (batch_id, record_id, conflict_type, description)
    VALUES (?, ?, ?, ?)
  `).run(batchId, recordId, conflictType, description);
}

function createOrUpdateDepartment(dept, batchId) {
  const recordId = addSyncRecord(batchId, 'department', dept.action || 'upsert', 'department', dept.id);
  
  try {
    if (dept.action === 'merge') {
      handleDepartmentMerge(dept, batchId, recordId);
    } else {
      const existing = db.prepare(`SELECT id FROM departments WHERE id = ?`).get(dept.id);
      
      if (existing) {
        db.prepare(`
          UPDATE departments SET name = ?, parent_id = ?, code = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(dept.name, dept.parent_id || null, dept.code, dept.status || 'active', dept.id);
      } else {
        db.prepare(`
          INSERT INTO departments (id, name, parent_id, code, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(dept.id, dept.name, dept.parent_id || null, dept.code, dept.status || 'active');
      }
    }
    
    updateRecordStatus(recordId, 'success');
    return { success: true };
  } catch (err) {
    updateRecordStatus(recordId, 'failed', err.message);
    return { success: false, error: err.message };
  }
}

function handleDepartmentMerge(dept, batchId, recordId) {
  if (!dept.target_dept_id) {
    throw new Error('部门合并需要指定 target_dept_id');
  }
  
  const targetDept = db.prepare(`SELECT id FROM departments WHERE id = ?`).get(dept.target_dept_id);
  if (!targetDept) {
    addConflict(batchId, recordId, 'missing_target', `目标部门不存在: ${dept.target_dept_id}`);
    throw new Error(`目标部门不存在: ${dept.target_dept_id}`);
  }
  
  const employees = db.prepare(`SELECT id FROM employees WHERE department_id = ?`).all(dept.id);
  
  for (const emp of employees) {
    const currentHistory = db.prepare(`
      SELECT id FROM department_history 
      WHERE employee_id = ? AND dept_id = ? AND end_date IS NULL
    `).get(emp.id, dept.id);
    
    if (currentHistory) {
      db.prepare(`UPDATE department_history SET end_date = CURRENT_TIMESTAMP WHERE id = ?`).run(currentHistory.id);
    }
    
    db.prepare(`INSERT INTO department_history (dept_id, employee_id) VALUES (?, ?)`).run(dept.target_dept_id, emp.id);
  }
  
  db.prepare(`UPDATE employees SET department_id = ?, updated_at = CURRENT_TIMESTAMP WHERE department_id = ?`)
    .run(dept.target_dept_id, dept.id);
  
  db.prepare(`UPDATE departments SET status = 'merged', parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(dept.target_dept_id, dept.id);
}

function processEmployeeChanges(employeeChanges, batchId) {
  const grouped = {};
  for (const change of employeeChanges) {
    if (!grouped[change.employee_id]) {
      grouped[change.employee_id] = [];
    }
    grouped[change.employee_id].push(change);
  }
  
  const results = [];
  
  for (const [employeeId, changes] of Object.entries(grouped)) {
    if (changes.length > 1) {
      const recordId = addSyncRecord(batchId, 'employee', 'multiple_changes', 'employee', employeeId);
      addConflict(batchId, recordId, 'multiple_changes', `员工 ${employeeId} 在本次同步中有 ${changes.length} 条变更记录`);
    }
    
    for (const change of changes) {
      const result = processSingleEmployeeChange(change, batchId);
      results.push(result);
    }
  }
  
  return results;
}

function processSingleEmployeeChange(change, batchId) {
  const recordId = addSyncRecord(batchId, 'employee', change.action, 'employee', change.employee_id);
  
  try {
    if (change.action === 'hire') {
      handleHire(change, batchId);
    } else if (change.action === 'transfer') {
      handleTransfer(change, batchId);
    } else if (change.action === 'terminate') {
      handleTermination(change, batchId);
    } else if (change.action === 'update') {
      handleEmployeeUpdate(change);
    } else {
      throw new Error(`未知的员工变更类型: ${change.action}`);
    }
    
    updateRecordStatus(recordId, 'success');
    return { success: true, employeeId: change.employee_id };
  } catch (err) {
    updateRecordStatus(recordId, 'failed', err.message);
    return { success: false, employeeId: change.employee_id, error: err.message };
  }
}

function handleHire(change, batchId) {
  const existing = db.prepare(`SELECT id FROM employees WHERE id = ?`).get(change.employee_id);
  
  if (!existing) {
    db.prepare(`
      INSERT INTO employees (id, name, emp_no, department_id, position, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(change.employee_id, change.name, change.emp_no, change.department_id, change.position);
    
    if (change.department_id) {
      db.prepare(`INSERT INTO department_history (dept_id, employee_id) VALUES (?, ?)`).run(change.department_id, change.employee_id);
    }
    
    if (change.roles && change.roles.length > 0) {
      for (const roleCode of change.roles) {
        const role = db.prepare(`SELECT id, name FROM roles WHERE code = ?`).get(roleCode);
        if (role) {
          db.prepare(`INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)`).run(change.employee_id, role.id);
        }
      }
    }
  }
}

function handleTransfer(change, batchId) {
  const employee = db.prepare(`SELECT id, department_id FROM employees WHERE id = ?`).get(change.employee_id);
  if (!employee) {
    throw new Error(`员工不存在: ${change.employee_id}`);
  }
  
  const oldDeptId = employee.department_id;
  
  if (change.department_id && change.department_id !== oldDeptId) {
    if (oldDeptId) {
      db.prepare(`
        UPDATE department_history SET end_date = CURRENT_TIMESTAMP 
        WHERE employee_id = ? AND dept_id = ? AND end_date IS NULL
      `).run(change.employee_id, oldDeptId);
    }
    
    db.prepare(`INSERT INTO department_history (dept_id, employee_id) VALUES (?, ?)`).run(change.department_id, change.employee_id);
    
    db.prepare(`
      UPDATE employees SET department_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(change.department_id, change.position || null, change.employee_id);
  } else {
    if (change.position) {
      db.prepare(`UPDATE employees SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(change.position, change.employee_id);
    }
  }
}

function handleEmployeeUpdate(change) {
  const fields = [];
  const values = [];
  
  if (change.name) { fields.push('name = ?'); values.push(change.name); }
  if (change.position) { fields.push('position = ?'); values.push(change.position); }
  if (change.status) { fields.push('status = ?'); values.push(change.status); }
  
  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(change.employee_id);
    db.prepare(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
}

function handleTermination(change, batchId) {
  const employee = db.prepare(`SELECT id, status FROM employees WHERE id = ?`).get(change.employee_id);
  if (!employee) {
    throw new Error(`员工不存在: ${change.employee_id}`);
  }
  
  db.prepare(`UPDATE employees SET status = 'terminated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(change.employee_id);
  
  const activeRoles = db.prepare(`
    SELECT er.id, er.role_id, r.name, r.is_sensitive
    FROM employee_roles er
    JOIN roles r ON er.role_id = r.id
    WHERE er.employee_id = ? AND er.revoked_at IS NULL
  `).all(change.employee_id);
  
  for (const role of activeRoles) {
    if (isRevokedInBatch(batchId, change.employee_id, role.role_id)) {
      continue;
    }
    
    let reason = '员工离职';
    if (role.is_sensitive) {
      reason = '员工离职 - 回收敏感角色';
    }
    
    db.prepare(`UPDATE employee_roles SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`).run(role.id);
    logRevocation(batchId, change.employee_id, role.role_id, role.name, reason);
  }
  
  const currentHistory = db.prepare(`
    SELECT id FROM department_history 
    WHERE employee_id = ? AND end_date IS NULL
  `).get(change.employee_id);
  
  if (currentHistory) {
    db.prepare(`UPDATE department_history SET end_date = CURRENT_TIMESTAMP WHERE id = ?`).run(currentHistory.id);
  }
}

function executeBatch(batchId) {
  const batch = db.prepare(`SELECT * FROM sync_batches WHERE id = ?`).get(batchId);
  if (!batch) {
    throw new Error(`批次不存在: ${batchId}`);
  }
  if (batch.status === 'completed') {
    throw new Error(`批次已完成，无法重复执行: ${batchId}`);
  }
  
  db.prepare(`UPDATE sync_batches SET status = 'processing' WHERE id = ?`).run(batchId);
  
  const pendingRecords = db.prepare(`
    SELECT * FROM sync_records WHERE batch_id = ? AND status IN ('pending', 'failed')
  `).all(batchId);
  
  let successCount = 0;
  let failedCount = 0;
  
  const departmentPending = pendingRecords.filter(r => r.record_type === 'department');
  const employeePending = pendingRecords.filter(r => r.record_type === 'employee');
  
  for (const record of departmentPending) {
    try {
      updateRecordStatus(record.id, 'success');
      successCount++;
    } catch (err) {
      updateRecordStatus(record.id, 'failed', err.message);
      failedCount++;
    }
  }
  
  for (const record of employeePending) {
    try {
      if (record.action === 'terminate') {
        const activeRoles = db.prepare(`
          SELECT er.id, er.role_id, r.name, r.is_sensitive
          FROM employee_roles er
          JOIN roles r ON er.role_id = r.id
          WHERE er.employee_id = ? AND er.revoked_at IS NULL
        `).all(record.entity_id);
        
        for (const role of activeRoles) {
          if (isRevokedInBatch(batchId, record.entity_id, role.role_id)) {
            continue;
          }
          let reason = role.is_sensitive ? '员工离职 - 回收敏感角色' : '员工离职';
          db.prepare(`UPDATE employee_roles SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`).run(role.id);
          logRevocation(batchId, record.entity_id, role.role_id, role.name, reason);
        }
      }
      updateRecordStatus(record.id, 'success');
      successCount++;
    } catch (err) {
      updateRecordStatus(record.id, 'failed', err.message);
      failedCount++;
    }
  }
  
  const status = failedCount > 0 ? 'partial' : 'completed';
  db.prepare(`
    UPDATE sync_batches 
    SET status = ?, success_count = ?, failed_count = ?, completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, successCount, failedCount, batchId);
  
  return getBatchReport(batchId);
}

function retryBatch(batchId) {
  const batch = db.prepare(`SELECT * FROM sync_batches WHERE id = ?`).get(batchId);
  if (!batch) {
    throw new Error(`批次不存在: ${batchId}`);
  }
  if (batch.status === 'completed') {
    throw new Error(`批次已完成，无需重试`);
  }
  
  db.prepare(`
    UPDATE sync_batches 
    SET status = 'pending', retry_count = retry_count + 1
    WHERE id = ?
  `).run(batchId);
  
  const failedRecords = db.prepare(`
    SELECT id FROM sync_records WHERE batch_id = ? AND status = 'failed'
  `).all(batchId);
  
  for (const rec of failedRecords) {
    updateRecordStatus(rec.id, 'pending');
  }
  
  return executeBatch(batchId);
}

function getBatchReport(batchId) {
  const batch = db.prepare(`SELECT * FROM sync_batches WHERE id = ?`).get(batchId);
  if (!batch) {
    return null;
  }
  
  const records = db.prepare(`SELECT * FROM sync_records WHERE batch_id = ?`).all(batchId);
  
  const deptChanges = records.filter(r => r.entity_type === 'department');
  const empChanges = records.filter(r => r.entity_type === 'employee');
  
  const revocations = db.prepare(`
    SELECT prl.*, e.name as employee_name
    FROM permission_revocation_logs prl
    LEFT JOIN employees e ON prl.employee_id = e.id
    WHERE prl.batch_id = ?
  `).all(batchId);
  
  const conflicts = db.prepare(`SELECT * FROM sync_conflicts WHERE batch_id = ?`).all(batchId);
  
  const permissionChanges = analyzePermissionChanges(batchId, records);
  
  return {
    batch_id: batchId,
    source: batch.source,
    status: batch.status,
    retry_count: batch.retry_count,
    created_at: batch.created_at,
    completed_at: batch.completed_at,
    statistics: {
      total: records.length,
      success: records.filter(r => r.status === 'success').length,
      failed: records.filter(r => r.status === 'failed').length,
      department_changes: deptChanges.length,
      employee_changes: empChanges.length
    },
    failed_records: records.filter(r => r.status === 'failed').map(r => ({
      id: r.id,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      error_message: r.error_message
    })),
    permission_changes: permissionChanges,
    revocations: revocations.map(r => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      role_id: r.role_id,
      role_name: r.role_name,
      reason: r.reason,
      revoked_at: r.revoked_at
    })),
    conflicts: conflicts.map(c => ({
      id: c.id,
      conflict_type: c.conflict_type,
      description: c.description,
      requires_manual_review: c.requires_manual_review === 1,
      resolved_at: c.resolved_at
    }))
  };
}

function analyzePermissionChanges(batchId, records) {
  const employeeIds = [...new Set(records.filter(r => r.entity_type === 'employee').map(r => r.entity_id))];
  
  const added = [];
  const retained = [];
  const revoked = [];
  
  for (const empId of employeeIds) {
    const roles = db.prepare(`
      SELECT r.id, r.name, r.code, er.granted_at, er.revoked_at
      FROM employee_roles er
      JOIN roles r ON er.role_id = r.id
      WHERE er.employee_id = ?
    `).all(empId);
    
    for (const role of roles) {
      const isRevoked = role.revoked_at !== null;
      const batchRevocation = db.prepare(`
        SELECT 1 FROM permission_revocation_logs 
        WHERE batch_id = ? AND employee_id = ? AND role_id = ?
      `).get(batchId, empId, role.id);
      
      if (batchRevocation && isRevoked) {
        revoked.push({ employee_id: empId, role_id: role.id, role_name: role.name });
      } else if (!isRevoked) {
        const isRecentlyGranted = db.prepare(`
          SELECT 1 FROM employee_roles 
          WHERE employee_id = ? AND role_id = ? 
          AND datetime(granted_at) >= datetime((SELECT created_at FROM sync_batches WHERE id = ?))
        `).get(empId, role.id, batchId);
        
        if (isRecentlyGranted) {
          added.push({ employee_id: empId, role_id: role.id, role_name: role.name });
        } else {
          retained.push({ employee_id: empId, role_id: role.id, role_name: role.name });
        }
      }
    }
  }
  
  return { added, retained, revoked };
}

function listBatches(limit = 20, offset = 0) {
  return db.prepare(`
    SELECT id, source, status, success_count, failed_count, created_at, completed_at, retry_count
    FROM sync_batches
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

module.exports = {
  createBatch,
  addSyncRecord,
  createOrUpdateDepartment,
  processEmployeeChanges,
  processSingleEmployeeChange,
  executeBatch,
  retryBatch,
  getBatchReport,
  listBatches
};
