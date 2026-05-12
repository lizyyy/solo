const db = require('./database');

const HIGH_RISK_FIELDS = {
  orders: ['status', 'amount'],
  members: ['balance', 'points', 'level'],
  invoices: ['status', 'amount']
};

const TABLE_MAP = {
  orders: db.orders,
  members: db.members,
  invoices: db.invoices
};

const TICKET_STATES = {
  DRAFT: 'draft',
  PENDING_PRECHECK: 'pending_precheck',
  PRECHECK_FAILED: 'precheck_failed',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  EXECUTING: 'executing',
  EXECUTED: 'executed',
  EXECUTION_FAILED: 'execution_failed',
  ROLLBACKING: 'rollbacking',
  ROLLED_BACK: 'rolled_back',
  ROLLBACK_FAILED: 'rollback_failed',
  CLOSED: 'closed',
  REJECTED: 'rejected'
};

const createTicket = (payload) => {
  const ticket = {
    id: db.generateId(),
    title: payload.title,
    description: payload.description || '',
    creator: payload.creator,
    department: payload.department,
    reason: payload.reason,
    repair_actions: payload.repair_actions,
    repair_actions_hash: hashRepairActions(payload.repair_actions),
    status: TICKET_STATES.DRAFT,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_approval_level: 0,
    required_approval_level: calculateRequiredApprovalLevel(payload.repair_actions),
    risk_level: 'low',
    precheck_id: null,
    approval_ids: [],
    execution_id: null,
    rollback_id: null,
    audit_id: null,
    snapshot_before: null,
    snapshot_after: null
  };
  db.tickets.set(ticket.id, ticket);
  return ticket;
};

const hashRepairActions = (actions) => {
  const str = JSON.stringify(actions, Object.keys(actions[0] || {}).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

const calculateRequiredApprovalLevel = (actions) => {
  let maxLevel = 0;
  for (const action of actions) {
    const highRisk = HIGH_RISK_FIELDS[action.table] || [];
    const affectedFields = Object.keys(action.updates || {});
    const hasHighRisk = affectedFields.some(f => highRisk.includes(f));
    if (hasHighRisk) {
      maxLevel = 2;
    }
  }
  return maxLevel;
};

const runPrecheck = (ticketId) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');

  if (![TICKET_STATES.DRAFT, TICKET_STATES.PRECHECK_FAILED].includes(ticket.status)) {
    throw new Error('当前状态不允许预检');
  }

  ticket.status = TICKET_STATES.PENDING_PRECHECK;
  ticket.updated_at = new Date().toISOString();
  db.tickets.set(ticketId, ticket);

  const precheck = {
    id: db.generateId(),
    ticket_id: ticketId,
    executor: ticket.creator,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    estimated_impact_count: 0,
    affected_records: [],
    high_risk_fields: [],
    warnings: [],
    errors: [],
    passed: false
  };
  db.prechecks.set(precheck.id, precheck);

  try {
    const affectedRecords = [];
    const highRiskFields = [];
    const warnings = [];
    const errors = [];

    for (const action of ticket.repair_actions) {
      const table = TABLE_MAP[action.table];
      if (!table) {
        errors.push(`未知表: ${action.table}`);
        continue;
      }

      const record = table.get(action.record_id);
      if (!record) {
        errors.push(`记录不存在: ${action.table}.${action.record_id}`);
        continue;
      }

      for (const [field, newValue] of Object.entries(action.updates)) {
        const currentValue = record[field];
        if (currentValue === undefined) {
          errors.push(`字段不存在: ${action.table}.${field}`);
          continue;
        }

        const highRiskList = HIGH_RISK_FIELDS[action.table] || [];
        if (highRiskList.includes(field)) {
          highRiskFields.push({
            table: action.table,
            record_id: action.record_id,
            field,
            old_value: currentValue,
            new_value: newValue
          });
        }

        if (String(currentValue) === String(newValue)) {
          warnings.push(`字段值未变化: ${action.table}.${action.record_id}.${field}`);
        }
      }

      const snapshot = JSON.parse(JSON.stringify(record));
      affectedRecords.push({
        table: action.table,
        record_id: action.record_id,
        snapshot_before: snapshot
      });
    }

    precheck.affected_records = affectedRecords;
    precheck.estimated_impact_count = affectedRecords.length;
    precheck.high_risk_fields = highRiskFields;
    precheck.warnings = warnings;
    precheck.errors = errors;
    precheck.passed = errors.length === 0;
    precheck.status = precheck.passed ? 'passed' : 'failed';
    precheck.completed_at = new Date().toISOString();

    if (precheck.passed) {
      ticket.status = TICKET_STATES.PENDING_APPROVAL;
      ticket.risk_level = highRiskFields.length > 0 ? 'high' : 'medium';
    } else {
      ticket.status = TICKET_STATES.PRECHECK_FAILED;
    }
    ticket.precheck_id = precheck.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);

    db.prechecks.set(precheck.id, precheck);
    return precheck;

  } catch (err) {
    precheck.status = 'error';
    precheck.errors.push(err.message);
    precheck.completed_at = new Date().toISOString();
    ticket.status = TICKET_STATES.PRECHECK_FAILED;
    ticket.precheck_id = precheck.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);
    db.prechecks.set(precheck.id, precheck);
    return precheck;
  }
};

const updateRepairActions = (ticketId, actions) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');
  if (ticket.status !== TICKET_STATES.DRAFT) {
    throw new Error('仅草稿状态允许修改修复动作');
  }
  ticket.repair_actions = actions;
  ticket.repair_actions_hash = hashRepairActions(actions);
  ticket.required_approval_level = calculateRequiredApprovalLevel(actions);
  ticket.updated_at = new Date().toISOString();
  db.tickets.set(ticketId, ticket);
  return ticket;
};

const approveTicket = (ticketId, payload) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');

  const precheck = ticket.precheck_id ? db.prechecks.get(ticket.precheck_id) : null;
  if (!precheck || !precheck.passed) {
    throw new Error('预检未通过，不能审批');
  }

  if (ticket.status !== TICKET_STATES.PENDING_APPROVAL) {
    throw new Error('当前状态不允许审批');
  }

  const currentHash = hashRepairActions(ticket.repair_actions);
  if (currentHash !== ticket.repair_actions_hash) {
    throw new Error('修复动作已被修改，需重新预检');
  }

  const level = payload.level || 1;
  const comment = payload.comment || '';

  const approval = {
    id: db.generateId(),
    ticket_id: ticketId,
    approver: payload.approver,
    level,
    comment,
    status: 'approved',
    approved_at: new Date().toISOString()
  };

  ticket.approval_ids.push(approval.id);
  ticket.current_approval_level = Math.max(ticket.current_approval_level, level);
  ticket.updated_at = new Date().toISOString();

  if (ticket.current_approval_level >= ticket.required_approval_level) {
    ticket.status = TICKET_STATES.APPROVED;
  }

  db.tickets.set(ticketId, ticket);
  db.approvals.set(approval.id, approval);
  return approval;
};

const rejectTicket = (ticketId, payload) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');

  if (![TICKET_STATES.PENDING_APPROVAL].includes(ticket.status)) {
    throw new Error('当前状态不允许驳回');
  }

  const approval = {
    id: db.generateId(),
    ticket_id: ticketId,
    approver: payload.approver,
    level: payload.level || 1,
    comment: payload.comment || '',
    status: 'rejected',
    approved_at: new Date().toISOString()
  };

  ticket.status = TICKET_STATES.REJECTED;
  ticket.approval_ids.push(approval.id);
  ticket.updated_at = new Date().toISOString();

  db.tickets.set(ticketId, ticket);
  db.approvals.set(approval.id, approval);
  return approval;
};

const executeTicket = (ticketId, payload) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');

  if (![TICKET_STATES.APPROVED, TICKET_STATES.EXECUTION_FAILED].includes(ticket.status)) {
    throw new Error('当前状态不允许执行');
  }

  if (ticket.execution_id) {
    const prevExec = db.executions.get(ticket.execution_id);
    if (prevExec && prevExec.status === 'success') {
      throw new Error('已执行成功，禁止重复执行');
    }
  }

  const currentHash = hashRepairActions(ticket.repair_actions);
  if (currentHash !== ticket.repair_actions_hash) {
    throw new Error('修复动作已被修改，需重新审批');
  }

  ticket.status = TICKET_STATES.EXECUTING;
  ticket.updated_at = new Date().toISOString();
  db.tickets.set(ticketId, ticket);

  const execution = {
    id: db.generateId(),
    ticket_id: ticketId,
    executor: payload.executor,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    snapshot_before: [],
    snapshot_after: [],
    actual_impact_count: 0,
    errors: [],
    rollback_data: []
  };
  db.executions.set(execution.id, execution);

  try {
    const rollbackData = [];
    const snapshotBefore = [];
    const snapshotAfter = [];

    for (const action of ticket.repair_actions) {
      const table = TABLE_MAP[action.table];
      const record = table.get(action.record_id);

      const before = JSON.parse(JSON.stringify(record));
      snapshotBefore.push({
        table: action.table,
        record_id: action.record_id,
        values: before
      });

      const rollbackUpdates = {};
      for (const [field, newValue] of Object.entries(action.updates)) {
        rollbackUpdates[field] = record[field];
        record[field] = newValue;
      }

      rollbackData.push({
        table: action.table,
        record_id: action.record_id,
        updates: rollbackUpdates
      });

      table.set(action.record_id, record);
      const after = JSON.parse(JSON.stringify(record));
      snapshotAfter.push({
        table: action.table,
        record_id: action.record_id,
        values: after
      });
    }

    execution.snapshot_before = snapshotBefore;
    execution.snapshot_after = snapshotAfter;
    execution.rollback_data = rollbackData;
    execution.actual_impact_count = snapshotBefore.length;
    execution.status = 'success';
    execution.completed_at = new Date().toISOString();

    ticket.status = TICKET_STATES.EXECUTED;
    ticket.snapshot_before = snapshotBefore;
    ticket.snapshot_after = snapshotAfter;
    ticket.execution_id = execution.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);

    const audit = createAudit(ticket, execution, payload.executor);
    ticket.audit_id = audit.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);

    db.executions.set(execution.id, execution);
    return execution;

  } catch (err) {
    execution.status = 'failed';
    execution.errors.push(err.message);
    execution.completed_at = new Date().toISOString();
    ticket.status = TICKET_STATES.EXECUTION_FAILED;
    ticket.execution_id = execution.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);
    db.executions.set(execution.id, execution);
    return execution;
  }
};

const createAudit = (ticket, execution, executor) => {
  const differences = [];
  for (const item of execution.snapshot_before) {
    const afterItem = execution.snapshot_after.find(
      a => a.table === item.table && a.record_id === item.record_id
    );
    if (!afterItem) continue;

    const fieldDiffs = [];
    for (const [field, oldVal] of Object.entries(item.values)) {
      const newVal = afterItem.values[field];
      if (String(oldVal) !== String(newVal)) {
        fieldDiffs.push({
          field,
          old_value: oldVal,
          new_value: newVal
        });
      }
    }

    if (fieldDiffs.length > 0) {
      differences.push({
        table: item.table,
        record_id: item.record_id,
        fields: fieldDiffs
      });
    }
  }

  const audit = {
    id: db.generateId(),
    ticket_id: ticket.id,
    execution_id: execution.id,
    executor,
    executed_at: new Date().toISOString(),
    affected_count: execution.actual_impact_count,
    differences,
    repair_actions: JSON.parse(JSON.stringify(ticket.repair_actions)),
    approvals: ticket.approval_ids.map(id => db.approvals.get(id)),
    precheck: db.prechecks.get(ticket.precheck_id)
  };
  db.audits.set(audit.id, audit);
  return audit;
};

const rollbackTicket = (ticketId, payload) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');

  if (![TICKET_STATES.EXECUTED, TICKET_STATES.ROLLBACK_FAILED].includes(ticket.status)) {
    throw new Error('当前状态不允许回滚');
  }

  if (!payload.reference_execution_id) {
    throw new Error('回滚必须引用原执行记录');
  }

  const execution = db.executions.get(payload.reference_execution_id);
  if (!execution) throw new Error('引用的执行记录不存在');
  if (execution.ticket_id !== ticketId) throw new Error('执行记录不属于当前工单');

  ticket.status = TICKET_STATES.ROLLBACKING;
  ticket.updated_at = new Date().toISOString();
  db.tickets.set(ticketId, ticket);

  const rollback = {
    id: db.generateId(),
    ticket_id: ticketId,
    reference_execution_id: payload.reference_execution_id,
    executor: payload.executor,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    errors: [],
    residual_differences: []
  };
  db.rollbacks.set(rollback.id, rollback);

  try {
    const residualDiffs = [];

    for (const item of execution.rollback_data) {
      const table = TABLE_MAP[item.table];
      const record = table.get(item.record_id);
      if (!record) {
        residualDiffs.push({
          table: item.table,
          record_id: item.record_id,
          issue: '记录已不存在，无法完全回滚'
        });
        continue;
      }

      for (const [field, oldVal] of Object.entries(item.updates)) {
        record[field] = oldVal;
      }
      table.set(item.record_id, record);
    }

    rollback.status = residualDiffs.length > 0 ? 'partial' : 'success';
    rollback.residual_differences = residualDiffs;
    rollback.completed_at = new Date().toISOString();

    if (rollback.status === 'success') {
      ticket.status = TICKET_STATES.ROLLED_BACK;
    } else {
      ticket.status = TICKET_STATES.ROLLBACK_FAILED;
    }
    ticket.rollback_id = rollback.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);

    db.rollbacks.set(rollback.id, rollback);
    return rollback;

  } catch (err) {
    rollback.status = 'failed';
    rollback.errors.push(err.message);
    rollback.completed_at = new Date().toISOString();
    ticket.status = TICKET_STATES.ROLLBACK_FAILED;
    ticket.rollback_id = rollback.id;
    ticket.updated_at = new Date().toISOString();
    db.tickets.set(ticketId, ticket);
    db.rollbacks.set(rollback.id, rollback);
    return rollback;
  }
};

const closeTicket = (ticketId, payload) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) throw new Error('工单不存在');

  const allowedStates = [
    TICKET_STATES.EXECUTED,
    TICKET_STATES.ROLLED_BACK,
    TICKET_STATES.ROLLBACK_FAILED,
    TICKET_STATES.REJECTED,
    TICKET_STATES.PRECHECK_FAILED,
    TICKET_STATES.DRAFT
  ];
  if (!allowedStates.includes(ticket.status)) {
    throw new Error('当前状态不允许关闭');
  }

  ticket.status = TICKET_STATES.CLOSED;
  ticket.closed_by = payload.closer;
  ticket.close_comment = payload.comment || '';
  ticket.closed_at = new Date().toISOString();
  ticket.updated_at = new Date().toISOString();
  db.tickets.set(ticketId, ticket);
  return ticket;
};

const getTicketDetails = (ticketId) => {
  const ticket = db.tickets.get(ticketId);
  if (!ticket) return null;

  return {
    ...ticket,
    precheck: ticket.precheck_id ? db.prechecks.get(ticket.precheck_id) : null,
    approvals: ticket.approval_ids.map(id => db.approvals.get(id)),
    execution: ticket.execution_id ? db.executions.get(ticket.execution_id) : null,
    rollback: ticket.rollback_id ? db.rollbacks.get(ticket.rollback_id) : null,
    audit: ticket.audit_id ? db.audits.get(ticket.audit_id) : null
  };
};

const listTickets = () => {
  return Array.from(db.tickets.values()).map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    creator: t.creator,
    risk_level: t.risk_level,
    created_at: t.created_at
  }));
};

const getAuditReport = (auditId) => {
  const audit = db.audits.get(auditId);
  if (!audit) return null;

  const rollback = audit.ticket_id ? 
    db.tickets.get(audit.ticket_id)?.rollback_id ? 
      db.rollbacks.get(db.tickets.get(audit.ticket_id).rollback_id) : null : null;

  return {
    ...audit,
    rollback_status: rollback ? rollback.status : null,
    residual_differences: rollback ? rollback.residual_differences : []
  };
};

module.exports = {
  TICKET_STATES,
  HIGH_RISK_FIELDS,
  createTicket,
  updateRepairActions,
  runPrecheck,
  approveTicket,
  rejectTicket,
  executeTicket,
  rollbackTicket,
  closeTicket,
  getTicketDetails,
  listTickets,
  getAuditReport,
  hashRepairActions
};
