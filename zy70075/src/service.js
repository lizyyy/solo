const { v4: uuidv4 } = require('uuid');
const db = require('./db');

function now() {
  return new Date().toISOString();
}

function writeAuditLog(action, operator, detail, formId = null, inventoryId = null, taskId = null) {
  db.run(`INSERT INTO audit_logs (id, form_id, inventory_id, task_id, action, operator, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), formId, inventoryId, taskId, action, operator, detail, now()]);
}

function createOffboardingForm(data, operator) {
  const existing = db.get(`SELECT * FROM offboarding_forms WHERE employee_id = ? AND status != '已完成'`,
    [data.employee_id]);
  if (existing) {
    return {
      success: false,
      duplicate: true,
      reason: `员工工号「${data.employee_id}」已有未完成的离职流程，工单号：${existing.id}`,
      data: existing
    };
  }

  const id = uuidv4();
  const createdAt = now();
  db.run(`INSERT INTO offboarding_forms (id, employee_id, employee_name, department, last_day, status, creator, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '待处理', ?, ?, ?)`,
    [id, data.employee_id, data.employee_name, data.department, data.last_day, operator, createdAt, createdAt]);

  writeAuditLog('创建离职单', operator, `创建了 ${data.employee_name} 的离职单`, id);

  return {
    success: true,
    duplicate: false,
    message: `离职单已创建，单号：${id}`,
    data: db.get(`SELECT * FROM offboarding_forms WHERE id = ?`, [id])
  };
}

function getFormById(formId) {
  return db.get(`SELECT * FROM offboarding_forms WHERE id = ?`, [formId]);
}

function generatePermissionInventory(formId, operator) {
  const form = getFormById(formId);
  if (!form) {
    return { success: false, reason: '找不到对应的离职单' };
  }

  const existing = db.all(`SELECT * FROM permission_inventories WHERE form_id = ?`, [formId]);
  if (existing.length > 0) {
    return {
      success: false,
      duplicate: true,
      reason: `该离职单已生成过权限清单，共 ${existing.length} 项`,
      data: existing
    };
  }

  const defaultPermissions = [
    { system_name: '企业邮箱', permission_type: '邮箱账号', permission_desc: `${form.employee_name} 的企业邮箱访问权限` },
    { system_name: 'VPN 系统', permission_type: 'VPN 账号', permission_desc: `${form.employee_name} 的远程办公 VPN 权限` },
    { system_name: 'OA 办公系统', permission_type: 'OA 账号', permission_desc: `${form.employee_name} 的办公审批、考勤权限` },
    { system_name: '代码仓库', permission_type: 'Git 账号', permission_desc: `${form.employee_name} 的代码拉取、提交权限` },
    { system_name: 'CRM 客户管理', permission_type: 'CRM 账号', permission_desc: `${form.employee_name} 的客户数据访问权限` }
  ];

  const createdAt = now();
  defaultPermissions.forEach(p => {
    const id = uuidv4();
    db.run(`INSERT INTO permission_inventories (id, form_id, system_name, permission_type, permission_desc, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, '待回收', ?, ?)`,
      [id, formId, p.system_name, p.permission_type, p.permission_desc, createdAt, createdAt]);
  });

  const permissions = db.all(`SELECT * FROM permission_inventories WHERE form_id = ?`, [formId]);

  writeAuditLog('生成权限清单', operator, `为 ${form.employee_name} 生成了 ${permissions.length} 项权限`, formId);

  db.run(`UPDATE offboarding_forms SET status = '权限清单已生成', updated_at = ? WHERE id = ?`, [now(), formId]);

  return {
    success: true,
    message: `已生成 ${permissions.length} 项待回收权限`,
    data: permissions
  };
}

function getPermissionsByForm(formId) {
  return db.all(`SELECT * FROM permission_inventories WHERE form_id = ?`, [formId]);
}

function createReclamationTasks(formId, operator) {
  const form = getFormById(formId);
  if (!form) {
    return { success: false, reason: '找不到对应的离职单' };
  }

  const permissions = getPermissionsByForm(formId);
  if (permissions.length === 0) {
    return { success: false, reason: '还没有权限清单，请先生成权限清单' };
  }

  const existingTasks = db.all(`SELECT * FROM reclamation_tasks WHERE form_id = ?`, [formId]);
  if (existingTasks.length > 0) {
    return {
      success: false,
      duplicate: true,
      reason: `回收任务已创建过，共 ${existingTasks.length} 个任务`,
      data: existingTasks
    };
  }

  const createdAt = now();
  permissions.forEach(p => {
    const id = uuidv4();
    db.run(`INSERT INTO reclamation_tasks (id, inventory_id, form_id, status, attempt_count, created_at, updated_at)
             VALUES (?, ?, ?, '待执行', 0, ?, ?)`,
      [id, p.id, formId, createdAt, createdAt]);
  });

  const tasks = db.all(`SELECT * FROM reclamation_tasks WHERE form_id = ?`, [formId]);

  writeAuditLog('创建回收任务', operator, `为 ${form.employee_name} 创建了 ${tasks.length} 个回收任务`, formId);

  db.run(`UPDATE offboarding_forms SET status = '回收任务已创建', updated_at = ? WHERE id = ?`, [now(), formId]);

  return {
    success: true,
    message: `已创建 ${tasks.length} 个回收任务`,
    data: tasks
  };
}

function simulateReclaim(inventoryId) {
  const inventory = db.get(`SELECT * FROM permission_inventories WHERE id = ?`, [inventoryId]);
  if (!inventory) return { success: false, error: '权限项不存在' };

  const exemption = db.get(`SELECT * FROM exemptions WHERE inventory_id = ? AND status = '已通过'`, [inventoryId]);
  if (exemption) {
    return { success: true, skipped: true, reason: '该权限已申请豁免并获得审批通过，跳过回收' };
  }

  const shouldFail = inventory.system_name === 'VPN 系统';
  if (shouldFail) {
    return { success: false, error: 'VPN 系统连接超时，暂时无法回收权限' };
  }

  return { success: true };
}

function executeReclamationTask(taskId, operator) {
  const task = db.get(`SELECT * FROM reclamation_tasks WHERE id = ?`, [taskId]);
  if (!task) {
    return { success: false, reason: '找不到对应的回收任务' };
  }

  if (task.status === '已完成') {
    return {
      success: false,
      duplicate: true,
      reason: '该回收任务已经执行成功，无需重复执行',
      data: task
    };
  }

  const inventory = db.get(`SELECT * FROM permission_inventories WHERE id = ?`, [task.inventory_id]);
  const form = getFormById(task.form_id);

  const executedAt = now();
  const result = simulateReclaim(task.inventory_id);
  const newAttemptCount = task.attempt_count + 1;

  if (result.success) {
    let newStatus = '已完成';
    let invStatus = '已回收';
    let message = '权限回收成功';

    if (result.skipped) {
      newStatus = '已豁免';
      invStatus = '已豁免';
      message = result.reason;
    }

    db.run(`UPDATE reclamation_tasks
             SET status = ?, attempt_count = ?, last_error = NULL, executed_at = ?, completed_at = ?, updated_at = ?
             WHERE id = ?`,
      [newStatus, newAttemptCount, executedAt, now(), now(), taskId]);

    db.run(`UPDATE permission_inventories SET status = ?, updated_at = ? WHERE id = ?`,
      [invStatus, now(), task.inventory_id]);

    writeAuditLog('执行回收任务', operator, `${message}：${inventory.system_name} - ${inventory.permission_type}`, task.form_id, inventory.id, taskId);

    refreshFormStatus(task.form_id);

    return {
      success: true,
      message,
      data: db.get(`SELECT * FROM reclamation_tasks WHERE id = ?`, [taskId])
    };
  } else {
    db.run(`UPDATE reclamation_tasks
             SET status = '执行失败', attempt_count = ?, last_error = ?, executed_at = ?, updated_at = ?
             WHERE id = ?`,
      [newAttemptCount, result.error, executedAt, now(), taskId]);

    db.run(`UPDATE permission_inventories SET status = '回收失败', updated_at = ? WHERE id = ?`,
      [now(), task.inventory_id]);

    writeAuditLog('执行回收任务失败', operator, `执行失败：${result.error}`, task.form_id, inventory.id, taskId);

    return {
      success: false,
      reason: result.error,
      data: db.get(`SELECT * FROM reclamation_tasks WHERE id = ?`, [taskId])
    };
  }
}

function retryFailedTask(taskId, operator) {
  const task = db.get(`SELECT * FROM reclamation_tasks WHERE id = ?`, [taskId]);
  if (!task) {
    return { success: false, reason: '找不到对应的回收任务' };
  }

  if (task.status !== '执行失败') {
    return {
      success: false,
      reason: `当前任务状态是「${task.status}」，只有「执行失败」状态才能重试`,
      data: task
    };
  }

  writeAuditLog('重试回收任务', operator, `重试任务 ${taskId}`, task.form_id, task.inventory_id, taskId);
  return executeReclamationTask(taskId, operator);
}

function applyExemption(formId, inventoryId, reason, applicant) {
  const form = getFormById(formId);
  if (!form) return { success: false, reason: '找不到对应的离职单' };

  const inventory = db.get(`SELECT * FROM permission_inventories WHERE id = ? AND form_id = ?`, [inventoryId, formId]);
  if (!inventory) return { success: false, reason: '找不到对应的权限项' };

  const existing = db.get(`SELECT * FROM exemptions WHERE inventory_id = ? AND status IN ('待审批', '已通过')`, [inventoryId]);
  if (existing) {
    return {
      success: false,
      duplicate: true,
      reason: `该权限已有${existing.status === '待审批' ? '待审批的' : '已通过的'}豁免申请`,
      data: existing
    };
  }

  const id = uuidv4();
  const createdAt = now();
  db.run(`INSERT INTO exemptions (id, form_id, inventory_id, reason, applicant, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '待审批', ?, ?)`,
    [id, formId, inventoryId, reason, applicant, createdAt, createdAt]);

  writeAuditLog('申请豁免', applicant, `申请豁免：${inventory.system_name} - ${inventory.permission_type}，原因：${reason}`, formId, inventoryId);

  return {
    success: true,
    message: '豁免申请已提交，等待审批',
    data: db.get(`SELECT * FROM exemptions WHERE id = ?`, [id])
  };
}

function approveExemption(exemptionId, approver) {
  const exemption = db.get(`SELECT * FROM exemptions WHERE id = ?`, [exemptionId]);
  if (!exemption) return { success: false, reason: '找不到对应的豁免申请' };

  if (exemption.status !== '待审批') {
    return {
      success: false,
      duplicate: true,
      reason: `该申请状态已经${exemption.status}，无需重复审批`,
      data: exemption
    };
  }

  db.run(`UPDATE exemptions SET status = '已通过', approver = ?, approved_at = ?, updated_at = ? WHERE id = ?`,
    [approver, now(), now(), exemptionId]);

  const inventory = db.get(`SELECT * FROM permission_inventories WHERE id = ?`, [exemption.inventory_id]);
  db.run(`UPDATE permission_inventories SET status = '已豁免', updated_at = ? WHERE id = ?`,
    [now(), exemption.inventory_id]);

  const task = db.get(`SELECT * FROM reclamation_tasks WHERE inventory_id = ?`, [exemption.inventory_id]);
  if (task) {
    db.run(`UPDATE reclamation_tasks SET status = '已豁免', updated_at = ? WHERE id = ?`,
      [now(), task.id]);
  }

  writeAuditLog('审批通过豁免', approver, `审批通过豁免：${inventory.system_name} - ${inventory.permission_type}`, exemption.form_id, exemption.inventory_id);

  refreshFormStatus(exemption.form_id);

  return {
    success: true,
    message: '豁免已审批通过，该权限将跳过回收',
    data: db.get(`SELECT * FROM exemptions WHERE id = ?`, [exemptionId])
  };
}

function refreshFormStatus(formId) {
  const tasks = db.all(`SELECT * FROM reclamation_tasks WHERE form_id = ?`, [formId]);
  if (tasks.length === 0) return;

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === '已完成' || t.status === '已豁免').length;
  const failed = tasks.filter(t => t.status === '执行失败').length;

  let formStatus;
  if (completed === total) {
    formStatus = '已完成';
  } else if (failed > 0) {
    formStatus = '部分失败';
  } else {
    formStatus = '回收中';
  }

  db.run(`UPDATE offboarding_forms SET status = ?, updated_at = ? WHERE id = ?`, [formStatus, now(), formId]);
}

function getAuditReport(formId) {
  const form = getFormById(formId);
  if (!form) return { success: false, reason: '找不到对应的离职单' };

  const permissions = db.all(`SELECT * FROM permission_inventories WHERE form_id = ?`, [formId]);
  const tasks = db.all(`SELECT * FROM reclamation_tasks WHERE form_id = ?`, [formId]);
  const exemptions = db.all(`SELECT * FROM exemptions WHERE form_id = ?`, [formId]);
  const logs = db.all(`SELECT * FROM audit_logs WHERE form_id = ? ORDER BY created_at ASC`, [formId]);

  const summary = {
    form,
    权限清单: {
      总数: permissions.length,
      已回收: permissions.filter(p => p.status === '已回收').length,
      已豁免: permissions.filter(p => p.status === '已豁免').length,
      回收失败: permissions.filter(p => p.status === '回收失败').length,
      待回收: permissions.filter(p => p.status === '待回收').length
    },
    回收任务: {
      总数: tasks.length,
      已完成: tasks.filter(t => t.status === '已完成').length,
      已豁免: tasks.filter(t => t.status === '已豁免').length,
      执行失败: tasks.filter(t => t.status === '执行失败').length,
      待执行: tasks.filter(t => t.status === '待执行').length
    },
    豁免申请: {
      总数: exemptions.length,
      待审批: exemptions.filter(e => e.status === '待审批').length,
      已通过: exemptions.filter(e => e.status === '已通过').length,
      已拒绝: exemptions.filter(e => e.status === '已拒绝').length
    },
    操作日志: logs.map(l => ({
      时间: l.created_at,
      操作人: l.operator,
      动作: l.action,
      详情: l.detail
    }))
  };

  return { success: true, data: summary };
}

function getAllForms() {
  return db.all(`SELECT * FROM offboarding_forms ORDER BY created_at DESC`);
}

module.exports = {
  createOffboardingForm,
  getFormById,
  generatePermissionInventory,
  getPermissionsByForm,
  createReclamationTasks,
  executeReclamationTask,
  retryFailedTask,
  applyExemption,
  approveExemption,
  getAuditReport,
  getAllForms,
  now
};
