const { v4: uuidv4 } = require('uuid');
const { query, run, transaction } = require('../storage/database');
const conflictChecker = require('./conflict-checker');
const auditService = require('./audit-service');
const timeRules = require('./time-rules');

/**
 * 计划状态机
 * 管理封锁计划的状态流转：
 * draft -> submitted -> approved -> (executing -> completed)
 *         \-> rejected
 *         \-> cancelled (any state)
 * 
 * 紧急插单流程：
 * draft (is_emergency=true) -> submitted -> emergency_approved -> ...
 */

const PLAN_STATES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EMERGENCY_APPROVED: 'emergency_approved',
  EXECUTING: 'executing',
  COMPLETED: 'completed'
};

const STATE_TRANSITIONS = {
  [PLAN_STATES.DRAFT]: ['submitted', 'cancelled'],
  [PLAN_STATES.SUBMITTED]: ['approved', 'rejected', 'cancelled'],
  [PLAN_STATES.APPROVED]: ['executing', 'cancelled'],
  [PLAN_STATES.EMERGENCY_APPROVED]: ['executing', 'cancelled'],
  [PLAN_STATES.EXECUTING]: ['completed', 'cancelled'],
  [PLAN_STATES.REJECTED]: ['draft'],
  [PLAN_STATES.CANCELLED]: [],
  [PLAN_STATES.COMPLETED]: []
};

/**
 * 检查状态转换是否合法
 */
function canTransition(fromState, toState) {
  const allowedTransitions = STATE_TRANSITIONS[fromState] || [];
  return allowedTransitions.includes(toState);
}

/**
 * 获取计划详情
 */
function getPlanById(planId) {
  const plans = query('SELECT * FROM blockade_plans WHERE id = ?', [planId]);
  if (plans.length === 0) return null;
  
  const plan = plans[0];
  
  // 解析 JSON 字段
  plan.section_ids = JSON.parse(plan.section_ids || '[]');
  plan.station_ids = JSON.parse(plan.station_ids || '[]');
  plan.catenary_zone_ids = JSON.parse(plan.catenary_zone_ids || '[]');
  
  return plan;
}

/**
 * 创建计划
 */
function createPlan(data, operator = null) {
  return transaction(() => {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    
    // 生成计划编号
    const planNumber = data.plan_number || generatePlanNumber();
    
    run(
      `INSERT INTO blockade_plans (
        id, plan_number, line_id, work_type, work_content,
        construction_team_id, priority, is_emergency, status,
        start_time, end_time, first_train_time, clearance_time,
        power_off_required, catenary_zone_ids, section_ids, station_ids,
        dispatch_command_id, applicant_id, applicant_name,
        notes, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        planNumber,
        data.line_id,
        data.work_type,
        data.work_content || null,
        data.construction_team_id || null,
        data.priority || 0,
        data.is_emergency ? 1 : 0,
        PLAN_STATES.DRAFT,
        data.start_time,
        data.end_time,
        data.first_train_time || null,
        data.clearance_time || null,
        data.power_off_required ? 1 : 0,
        JSON.stringify(data.catenary_zone_ids || []),
        JSON.stringify(data.section_ids || []),
        JSON.stringify(data.station_ids || []),
        data.dispatch_command_id || null,
        data.applicant_id || null,
        data.applicant_name || null,
        data.notes || null,
        1,
        now,
        now
      ]
    );
    
    const plan = getPlanById(id);
    
    // 记录审计日志
    auditService.logPlanCreate(plan, operator);
    
    // 创建初始版本
    savePlanVersion(plan, '初始版本', operator);
    
    return plan;
  });
}

/**
 * 更新计划（仅草稿状态可更新）
 */
function updatePlan(planId, data, operator = null) {
  return transaction(() => {
    const existingPlan = getPlanById(planId);
    
    if (!existingPlan) {
      throw new Error(`计划不存在: ${planId}`);
    }
    
    // 只有草稿状态可以更新
    if (existingPlan.status !== PLAN_STATES.DRAFT && existingPlan.status !== PLAN_STATES.REJECTED) {
      throw new Error(`只能更新草稿或已拒绝状态的计划，当前状态: ${existingPlan.status}`);
    }
    
    const now = new Date().toISOString();
    const newVersion = (existingPlan.version || 0) + 1;
    
    const updates = [];
    const params = [];
    
    const allowedFields = [
      'line_id', 'work_type', 'work_content', 'construction_team_id',
      'priority', 'is_emergency', 'start_time', 'end_time',
      'first_train_time', 'clearance_time', 'power_off_required',
      'catenary_zone_ids', 'section_ids', 'station_ids',
      'dispatch_command_id', 'applicant_id', 'applicant_name', 'notes'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'section_ids' || field === 'station_ids' || field === 'catenary_zone_ids') {
          params.push(JSON.stringify(data[field]));
        } else if (field === 'is_emergency' || field === 'power_off_required') {
          params.push(data[field] ? 1 : 0);
        } else {
          params.push(data[field]);
        }
      }
    });
    
    updates.push('version = ?');
    updates.push('updated_at = ?');
    params.push(newVersion, now, planId);
    
    run(`UPDATE blockade_plans SET ${updates.join(', ')} WHERE id = ?`, params);
    
    const updatedPlan = getPlanById(planId);
    
    // 记录审计日志
    auditService.logPlanUpdate(existingPlan, updatedPlan, operator);
    
    // 保存版本
    savePlanVersion(updatedPlan, data.change_reason || '更新计划', operator);
    
    return updatedPlan;
  });
}

/**
 * 提交计划审批
 */
function submitPlan(planId, operator = null) {
  return transitionState(planId, PLAN_STATES.SUBMITTED, operator, (plan) => {
    // 提交前自动执行冲突检查
    const checkResult = conflictChecker.checkPlanConflicts(plan);
    
    // 即使有警告也可以提交，但会记录
    return {
      conflict_check_result: JSON.stringify(checkResult),
      submitted_at: new Date().toISOString()
    };
  });
}

/**
 * 审批通过计划
 */
function approvePlan(planId, notes = '', operator = null) {
  return transaction(() => {
    const plan = getPlanById(planId);
    
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`);
    }
    
    // 审批前必须通过冲突检查
    const checkResult = conflictChecker.checkPlanConflicts(plan);
    
    if (!checkResult.is_passed) {
      throw new Error(`计划存在冲突，无法审批通过: ${checkResult.conflicts.map(c => c.message).join('; ')}`);
    }
    
    // 状态转换
    const targetState = plan.is_emergency ? PLAN_STATES.EMERGENCY_APPROVED : PLAN_STATES.APPROVED;
    
    const now = new Date().toISOString();
    run(
      `UPDATE blockade_plans 
       SET status = ?, approver_id = ?, approver_name = ?, approved_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        targetState,
        operator?.id || null,
        operator?.name || '系统',
        now,
        now,
        planId
      ]
    );
    
    const updatedPlan = getPlanById(planId);
    
    // 记录审计日志
    auditService.logPlanApprove(updatedPlan, operator, notes);
    
    // 保存版本
    savePlanVersion(updatedPlan, `审批通过: ${notes || '无备注'}`, operator);
    
    // 记录资源占用
    recordResourceOccupations(updatedPlan);
    
    return updatedPlan;
  });
}

/**
 * 拒绝计划
 */
function rejectPlan(planId, reason = '', operator = null) {
  return transitionState(planId, PLAN_STATES.REJECTED, operator, () => ({}), reason);
}

/**
 * 撤销计划
 */
function cancelPlan(planId, reason = '', operator = null) {
  return transaction(() => {
    const plan = getPlanById(planId);
    
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`);
    }
    
    // 已完成的计划不能撤销
    if (plan.status === PLAN_STATES.COMPLETED) {
      throw new Error('已完成的计划不能撤销');
    }
    
    const now = new Date().toISOString();
    run(
      `UPDATE blockade_plans 
       SET status = ?, cancelled_at = ?, cancelled_reason = ?, updated_at = ?
       WHERE id = ?`,
      [
        PLAN_STATES.CANCELLED,
        now,
        reason,
        now,
        planId
      ]
    );
    
    // 清理资源占用
    run('DELETE FROM resource_occupations WHERE plan_id = ?', [planId]);
    
    const updatedPlan = getPlanById(planId);
    
    // 记录审计日志
    auditService.logPlanCancel(updatedPlan, operator, reason);
    
    return updatedPlan;
  });
}

/**
 * 通用状态转换函数
 */
function transitionState(planId, targetState, operator = null, extraDataFn = null, reason = '') {
  return transaction(() => {
    const plan = getPlanById(planId);
    
    if (!plan) {
      throw new Error(`计划不存在: ${planId}`);
    }
    
    if (!canTransition(plan.status, targetState)) {
      throw new Error(`无法从状态 ${plan.status} 转换到 ${targetState}`);
    }
    
    const now = new Date().toISOString();
    const extraData = extraDataFn ? extraDataFn(plan) : {};
    
    // 构建更新语句
    const updates = ['status = ?', 'updated_at = ?'];
    const params = [targetState, now];
    
    for (const [key, value] of Object.entries(extraData)) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
    
    params.push(planId);
    
    run(`UPDATE blockade_plans SET ${updates.join(', ')} WHERE id = ?`, params);
    
    const updatedPlan = getPlanById(planId);
    
    // 记录审计日志
    switch (targetState) {
      case PLAN_STATES.SUBMITTED:
        auditService.logPlanSubmit(updatedPlan, operator);
        break;
      case PLAN_STATES.REJECTED:
        auditService.logPlanReject(updatedPlan, operator, reason);
        break;
    }
    
    return updatedPlan;
  });
}

/**
 * 保存计划版本
 */
function savePlanVersion(plan, changeReason = '', operator = null) {
  const id = uuidv4();
  
  // 复制计划数据
  const planData = { ...plan };
  // 移除不需要的字段
  delete planData.id;
  
  run(
    `INSERT INTO plan_versions (
      id, plan_id, version, plan_data, change_reason, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      plan.id,
      plan.version,
      JSON.stringify(planData),
      changeReason,
      operator?.id || null,
      new Date().toISOString()
    ]
  );
  
  return id;
}

/**
 * 记录资源占用
 */
function recordResourceOccupations(plan) {
  const now = new Date().toISOString();
  
  // 记录区间占用
  const sectionIds = plan.section_ids || [];
  for (const sectionId of sectionIds) {
    run(
      `INSERT INTO resource_occupations (
        id, plan_id, resource_type, resource_id, start_time, end_time
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        plan.id,
        'section',
        sectionId,
        plan.start_time,
        plan.end_time
      ]
    );
  }
  
  // 记录施工队占用
  if (plan.construction_team_id) {
    run(
      `INSERT INTO resource_occupations (
        id, plan_id, resource_type, resource_id, start_time, end_time
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        plan.id,
        'team',
        plan.construction_team_id,
        plan.start_time,
        plan.end_time
      ]
    );
  }
  
  // 记录接触网占用
  if (plan.power_off_required && plan.catenary_zone_ids) {
    const catenaryIds = plan.catenary_zone_ids || [];
    for (const zoneId of catenaryIds) {
      run(
        `INSERT INTO resource_occupations (
          id, plan_id, resource_type, resource_id, start_time, end_time
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          plan.id,
          'catenary',
          zoneId,
          plan.start_time,
          plan.end_time
        ]
      );
    }
  }
}

/**
 * 获取计划列表
 */
function getPlans(options = {}) {
  const {
    status,
    line_id,
    start_time_from,
    start_time_to,
    is_emergency,
    limit = 100,
    offset = 0
  } = options;
  
  let sql = 'SELECT * FROM blockade_plans WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  if (line_id) {
    sql += ' AND line_id = ?';
    params.push(line_id);
  }
  
  if (start_time_from) {
    sql += ' AND start_time >= ?';
    params.push(start_time_from);
  }
  
  if (start_time_to) {
    sql += ' AND start_time <= ?';
    params.push(start_time_to);
  }
  
  if (is_emergency !== undefined) {
    sql += ' AND is_emergency = ?';
    params.push(is_emergency ? 1 : 0);
  }
  
  sql += ' ORDER BY start_time DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const plans = query(sql, params);
  
  return plans.map(plan => ({
    ...plan,
    section_ids: JSON.parse(plan.section_ids || '[]'),
    station_ids: JSON.parse(plan.station_ids || '[]'),
    catenary_zone_ids: JSON.parse(plan.catenary_zone_ids || '[]')
  }));
}

/**
 * 获取计划版本历史
 */
function getPlanVersions(planId) {
  const versions = query(
    'SELECT * FROM plan_versions WHERE plan_id = ? ORDER BY version DESC',
    [planId]
  );
  
  return versions.map(v => ({
    ...v,
    plan_data: JSON.parse(v.plan_data || '{}')
  }));
}

/**
 * 生成计划编号
 */
function generatePlanNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  // 查询今日已有的计划数量
  const todayPlans = query(
    `SELECT COUNT(*) as count FROM blockade_plans 
     WHERE plan_number LIKE ?`,
    [`BLK-${dateStr}-%`]
  );
  
  const count = todayPlans[0]?.count || 0;
  const seq = String(count + 1).padStart(4, '0');
  
  return `BLK-${dateStr}-${seq}`;
}

/**
 * 删除计划（仅草稿状态）
 */
function deletePlan(planId, operator = null) {
  const plan = getPlanById(planId);
  
  if (!plan) {
    throw new Error(`计划不存在: ${planId}`);
  }
  
  if (plan.status !== PLAN_STATES.DRAFT && plan.status !== PLAN_STATES.REJECTED) {
    throw new Error('只能删除草稿或已拒绝状态的计划');
  }
  
  // 删除相关数据
  run('DELETE FROM plan_versions WHERE plan_id = ?', [planId]);
  run('DELETE FROM conflict_checks WHERE plan_id = ?', [planId]);
  run('DELETE FROM resource_occupations WHERE plan_id = ?', [planId]);
  run('DELETE FROM blockade_plans WHERE id = ?', [planId]);
  
  // 记录审计日志
  auditService.createAuditLog({
    operationType: auditService.OPERATION_TYPES.DELETE,
    entityType: auditService.ENTITY_TYPES.PLAN,
    entityId: planId,
    oldValue: plan,
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: '删除计划'
  });
  
  return true;
}

module.exports = {
  PLAN_STATES,
  STATE_TRANSITIONS,
  canTransition,
  getPlanById,
  getPlans,
  createPlan,
  updatePlan,
  submitPlan,
  approvePlan,
  rejectPlan,
  cancelPlan,
  deletePlan,
  getPlanVersions,
  savePlanVersion,
  generatePlanNumber
};
