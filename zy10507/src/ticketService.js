const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const SLA_CONFIG = {
  P1: { nodeTimeout: 30 * 60 * 1000, reminderInterval: 10 * 60 * 1000 },
  P2: { nodeTimeout: 2 * 60 * 60 * 1000, reminderInterval: 30 * 60 * 1000 },
  P3: { nodeTimeout: 4 * 60 * 60 * 1000, reminderInterval: 60 * 60 * 1000 },
  P4: { nodeTimeout: 8 * 60 * 60 * 1000, reminderInterval: 2 * 60 * 60 * 1000 }
};

const NODE_FLOW = ['L1_SUPPORT', 'L2_SUPPORT', 'L3_ENGINEERING', 'MANAGER_ESCALATION'];

function calculateDeadline(priority, baseTime = Date.now()) {
  const config = SLA_CONFIG[priority];
  return new Date(baseTime + config.nodeTimeout).toISOString();
}

function getDeduplicationKey(ticketNumber, nodeName, reminderType) {
  const hour = new Date().getHours();
  return `${ticketNumber}-${nodeName}-${reminderType}-${hour}`;
}

async function createTicket(ticketData) {
  const { ticketNumber, priority, initialNode = 'L1_SUPPORT', assignee, rawInput } = ticketData;

  if (!['P1', 'P2', 'P3', 'P4'].includes(priority)) {
    throw new Error('无效的优先级');
  }

  const deadline = calculateDeadline(priority);

  await db.runQuery(
    `INSERT INTO tickets (ticket_number, priority, current_node, deadline, status, raw_input) 
     VALUES (?, ?, ?, ?, 'PROCESSING', ?)`,
    [ticketNumber, priority, initialNode, deadline, JSON.stringify(rawInput || ticketData)]
  );

  await db.runQuery(
    `INSERT INTO ticket_nodes (ticket_number, node_name, assignee, sla_deadline) 
     VALUES (?, ?, ?, ?)`,
    [ticketNumber, initialNode, assignee, deadline]
  );

  return getTicket(ticketNumber);
}

async function getTicket(ticketNumber) {
  const ticket = await db.getOne(
    'SELECT * FROM tickets WHERE ticket_number = ?',
    [ticketNumber]
  );

  if (!ticket) return null;

  const nodes = await db.getAll(
    'SELECT * FROM ticket_nodes WHERE ticket_number = ? ORDER BY entered_at',
    [ticketNumber]
  );

  const reminders = await db.getAll(
    'SELECT * FROM reminders WHERE ticket_number = ? ORDER BY sent_at',
    [ticketNumber]
  );

  const escalations = await db.getAll(
    'SELECT * FROM escalations WHERE ticket_number = ? ORDER BY escalated_at',
    [ticketNumber]
  );

  const corrections = await db.getAll(
    'SELECT * FROM manual_corrections WHERE ticket_number = ? ORDER BY corrected_at',
    [ticketNumber]
  );

  return { ...ticket, nodes, reminders, escalations, corrections };
}

async function listTickets(filters = {}) {
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.priority) {
    sql += ' AND priority = ?';
    params.push(filters.priority);
  }
  if (filters.currentNode) {
    sql += ' AND current_node = ?';
    params.push(filters.currentNode);
  }

  sql += ' ORDER BY created_at DESC';

  return db.getAll(sql, params);
}

async function advanceNode(ticketNumber, nextAssignee, processingNotes = '') {
  const ticket = await getTicket(ticketNumber);
  if (!ticket) throw new Error('工单不存在');
  if (ticket.status === 'RESOLVED') throw new Error('工单已完结');

  const currentIndex = NODE_FLOW.indexOf(ticket.current_node);
  if (currentIndex === -1 || currentIndex >= NODE_FLOW.length - 1) {
    throw new Error('无法推进到下一节点');
  }

  const nextNode = NODE_FLOW[currentIndex + 1];
  const now = new Date().toISOString();

  await db.runQuery(
    'UPDATE ticket_nodes SET left_at = ?, status = ? WHERE ticket_number = ? AND node_name = ? AND status = ?',
    [now, 'COMPLETED', ticketNumber, ticket.current_node, 'ACTIVE']
  );

  const newDeadline = calculateDeadline(ticket.priority);

  await db.runQuery(
    `INSERT INTO ticket_nodes (ticket_number, node_name, assignee, sla_deadline) 
     VALUES (?, ?, ?, ?)`,
    [ticketNumber, nextNode, nextAssignee, newDeadline]
  );

  await db.runQuery(
    'UPDATE tickets SET current_node = ?, deadline = ?, updated_at = ?, processing_notes = COALESCE(processing_notes, "") || ? WHERE ticket_number = ?',
    [nextNode, newDeadline, now, `\n节点推进: ${ticket.current_node} -> ${nextNode}\n${processingNotes}\n`, ticketNumber]
  );

  return getTicket(ticketNumber);
}

async function escalate(ticketNumber, reason, escalatedTo) {
  const ticket = await getTicket(ticketNumber);
  if (!ticket) throw new Error('工单不存在');

  const currentIndex = NODE_FLOW.indexOf(ticket.current_node);
  const toNode = currentIndex < NODE_FLOW.length - 1 ? NODE_FLOW[currentIndex + 1] : 'MANAGER_ESCALATION';

  await db.runQuery(
    `INSERT INTO escalations (ticket_number, from_node, to_node, reason, escalated_to) 
     VALUES (?, ?, ?, ?, ?)`,
    [ticketNumber, ticket.current_node, toNode, reason, escalatedTo]
  );

  await db.runQuery(
    'UPDATE tickets SET status = ?, updated_at = ? WHERE ticket_number = ?',
    ['ESCALATED', new Date().toISOString(), ticketNumber]
  );

  return getTicket(ticketNumber);
}

async function createReminder(ticketNumber, reminderType, sentTo) {
  const ticket = await getTicket(ticketNumber);
  if (!ticket) throw new Error('工单不存在');

  const dedupKey = getDeduplicationKey(ticketNumber, ticket.current_node, reminderType);

  const existing = await db.getOne(
    'SELECT id FROM reminders WHERE deduplication_key = ?',
    [dedupKey]
  );

  if (existing) {
    return { duplicated: true, reminderId: existing.id };
  }

  const result = await db.runQuery(
    `INSERT INTO reminders (ticket_number, node_name, reminder_type, sent_to, deduplication_key) 
     VALUES (?, ?, ?, ?, ?)`,
    [ticketNumber, ticket.current_node, reminderType, sentTo, dedupKey]
  );

  return { duplicated: false, reminderId: result.lastID };
}

async function handleException(ticketNumber, exceptionDetails) {
  const ticket = await getTicket(ticketNumber);
  if (!ticket) throw new Error('工单不存在');

  await db.runQuery(
    `UPDATE tickets 
     SET status = ?, updated_at = ?, processing_notes = COALESCE(processing_notes, "") || ? 
     WHERE ticket_number = ?`,
    [
      'EXCEPTION',
      new Date().toISOString(),
      `\n异常记录: ${JSON.stringify(exceptionDetails)}\n`,
      ticketNumber
    ]
  );

  return getTicket(ticketNumber);
}

async function manualCorrection(ticketNumber, correctedBy, correctionType, oldValue, newValue, reason) {
  const ticket = await getTicket(ticketNumber);
  if (!ticket) throw new Error('工单不存在');

  await db.runQuery(
    `INSERT INTO manual_corrections 
     (ticket_number, corrected_by, correction_type, old_value, new_value, reason) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ticketNumber, correctedBy, correctionType, oldValue, newValue, reason]
  );

  switch (correctionType) {
    case 'DEADLINE':
      await db.runQuery(
        'UPDATE tickets SET deadline = ?, updated_at = ? WHERE ticket_number = ?',
        [newValue, new Date().toISOString(), ticketNumber]
      );
      await db.runQuery(
        'UPDATE ticket_nodes SET sla_deadline = ? WHERE ticket_number = ? AND status = ?',
        [newValue, ticketNumber, 'ACTIVE']
      );
      break;
    case 'ASSIGNEE':
      await db.runQuery(
        'UPDATE ticket_nodes SET assignee = ? WHERE ticket_number = ? AND status = ?',
        [newValue, ticketNumber, 'ACTIVE']
      );
      break;
    case 'STATUS':
      await db.runQuery(
        'UPDATE tickets SET status = ?, updated_at = ? WHERE ticket_number = ?',
        [newValue, new Date().toISOString(), ticketNumber]
      );
      break;
    case 'NODE':
      await db.runQuery(
        'UPDATE ticket_nodes SET left_at = ?, status = ? WHERE ticket_number = ? AND status = ?',
        [new Date().toISOString(), 'MANUALLY_CORRECTED', ticketNumber, 'ACTIVE']
      );
      await db.runQuery(
        `INSERT INTO ticket_nodes (ticket_number, node_name, assignee, sla_deadline, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [ticketNumber, newValue, 'manual', calculateDeadline(ticket.priority), 'ACTIVE']
      );
      await db.runQuery(
        'UPDATE tickets SET current_node = ?, updated_at = ? WHERE ticket_number = ?',
        [newValue, new Date().toISOString(), ticketNumber]
      );
      break;
  }

  return getTicket(ticketNumber);
}

async function resolveTicket(ticketNumber, conclusion) {
  const now = new Date().toISOString();

  await db.runQuery(
    'UPDATE ticket_nodes SET left_at = ?, status = ? WHERE ticket_number = ? AND status = ?',
    [now, 'COMPLETED', ticketNumber, 'ACTIVE']
  );

  await db.runQuery(
    'UPDATE tickets SET status = ?, conclusion = ?, updated_at = ? WHERE ticket_number = ?',
    ['RESOLVED', conclusion, now, ticketNumber]
  );

  return getTicket(ticketNumber);
}

async function checkSLAAndRemind() {
  const now = Date.now();
  const tickets = await listTickets({ status: 'PROCESSING' });
  const results = [];

  for (const ticket of tickets) {
    const deadline = new Date(ticket.deadline).getTime();
    const timeLeft = deadline - now;
    const config = SLA_CONFIG[ticket.priority];

    if (timeLeft <= 0) {
      await escalate(ticket.ticket_number, 'SLA超时', 'AUTO_ESCALATION');
      results.push({ ticketNumber: ticket.ticket_number, action: 'escalated', reason: 'SLA超时' });
    } else if (timeLeft <= config.reminderInterval) {
      const activeNode = await db.getOne(
        'SELECT assignee FROM ticket_nodes WHERE ticket_number = ? AND status = ?',
        [ticket.ticket_number, 'ACTIVE']
      );
      const reminder = await createReminder(
        ticket.ticket_number,
        'SLA_WARNING',
        activeNode?.assignee || 'SYSTEM'
      );
      results.push({ ticketNumber: ticket.ticket_number, action: 'reminded', duplicated: reminder.duplicated });
    }
  }

  return results;
}

module.exports = {
  createTicket,
  getTicket,
  listTickets,
  advanceNode,
  escalate,
  createReminder,
  handleException,
  manualCorrection,
  resolveTicket,
  checkSLAAndRemind,
  calculateDeadline,
  NODE_FLOW,
  SLA_CONFIG
};
