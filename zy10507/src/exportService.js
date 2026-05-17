const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const ticketService = require('./ticketService');
const db = require('./database');

const exportDir = path.join(__dirname, '..', 'data', 'exports');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

async function exportTicketsToCSV(filters = {}) {
  const tickets = await ticketService.listTickets(filters);
  const filePath = path.join(exportDir, `tickets-${Date.now()}.csv`);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'ticket_number', title: '工单编号' },
      { id: 'priority', title: '优先级' },
      { id: 'current_node', title: '当前节点' },
      { id: 'deadline', title: '截止时间' },
      { id: 'status', title: '状态' },
      { id: 'created_at', title: '创建时间' },
      { id: 'updated_at', title: '更新时间' },
      { id: 'conclusion', title: '处理结论' }
    ]
  });

  await csvWriter.writeRecords(tickets);
  return filePath;
}

async function exportEscalationsToCSV(filters = {}) {
  let sql = `
    SELECT 
      e.ticket_number,
      t.priority,
      e.from_node,
      e.to_node,
      e.escalated_at,
      e.reason,
      e.escalated_to
    FROM escalations e
    JOIN tickets t ON e.ticket_number = t.ticket_number
    WHERE 1=1
  `;
  const params = [];

  if (filters.priority) {
    sql += ' AND t.priority = ?';
    params.push(filters.priority);
  }

  sql += ' ORDER BY e.escalated_at DESC';

  const escalations = await db.getAll(sql, params);

  const filePath = path.join(exportDir, `escalations-${Date.now()}.csv`);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'ticket_number', title: '工单编号' },
      { id: 'priority', title: '优先级' },
      { id: 'from_node', title: '源节点' },
      { id: 'to_node', title: '目标节点' },
      { id: 'escalated_at', title: '升级时间' },
      { id: 'reason', title: '升级原因' },
      { id: 'escalated_to', title: '升级至' }
    ]
  });

  await csvWriter.writeRecords(escalations);
  return filePath;
}

async function exportSingleTicketToCSV(ticketNumber) {
  const ticket = await ticketService.getTicket(ticketNumber);
  if (!ticket) throw new Error('工单不存在');

  const filePath = path.join(exportDir, `ticket-${ticketNumber}-${Date.now()}.csv`);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'section', title: '数据段' },
      { id: 'field', title: '字段' },
      { id: 'value', title: '值' }
    ]
  });

  const records = [];

  records.push(
    { section: '工单基本信息', field: '工单编号', value: ticket.ticket_number },
    { section: '工单基本信息', field: '优先级', value: ticket.priority },
    { section: '工单基本信息', field: '当前节点', value: ticket.current_node },
    { section: '工单基本信息', field: '截止时间', value: ticket.deadline },
    { section: '工单基本信息', field: '状态', value: ticket.status },
    { section: '工单基本信息', field: '创建时间', value: ticket.created_at },
    { section: '工单基本信息', field: '更新时间', value: ticket.updated_at },
    { section: '工单基本信息', field: '处理结论', value: ticket.conclusion || '' }
  );

  ticket.nodes.forEach((node, index) => {
    records.push(
      { section: `节点记录 ${index + 1}`, field: '节点名称', value: node.node_name },
      { section: `节点记录 ${index + 1}`, field: '处理人', value: node.assignee },
      { section: `节点记录 ${index + 1}`, field: '进入时间', value: node.entered_at },
      { section: `节点记录 ${index + 1}`, field: '离开时间', value: node.left_at || '' },
      { section: `节点记录 ${index + 1}`, field: 'SLA截止时间', value: node.sla_deadline },
      { section: `节点记录 ${index + 1}`, field: '节点状态', value: node.status }
    );
  });

  ticket.reminders.forEach((reminder, index) => {
    records.push(
      { section: `催办记录 ${index + 1}`, field: '节点', value: reminder.node_name },
      { section: `催办记录 ${index + 1}`, field: '催办类型', value: reminder.reminder_type },
      { section: `催办记录 ${index + 1}`, field: '发送时间', value: reminder.sent_at },
      { section: `催办记录 ${index + 1}`, field: '发送对象', value: reminder.sent_to }
    );
  });

  ticket.escalations.forEach((escalation, index) => {
    records.push(
      { section: `升级记录 ${index + 1}`, field: '源节点', value: escalation.from_node },
      { section: `升级记录 ${index + 1}`, field: '目标节点', value: escalation.to_node },
      { section: `升级记录 ${index + 1}`, field: '升级时间', value: escalation.escalated_at },
      { section: `升级记录 ${index + 1}`, field: '升级原因', value: escalation.reason },
      { section: `升级记录 ${index + 1}`, field: '升级至', value: escalation.escalated_to }
    );
  });

  ticket.corrections.forEach((correction, index) => {
    records.push(
      { section: `人工修正记录 ${index + 1}`, field: '修正人', value: correction.corrected_by },
      { section: `人工修正记录 ${index + 1}`, field: '修正类型', value: correction.correction_type },
      { section: `人工修正记录 ${index + 1}`, field: '原值', value: correction.old_value || '' },
      { section: `人工修正记录 ${index + 1}`, field: '新值', value: correction.new_value },
      { section: `人工修正记录 ${index + 1}`, field: '修正时间', value: correction.corrected_at },
      { section: `人工修正记录 ${index + 1}`, field: '修正原因', value: correction.reason || '' }
    );
  });

  await csvWriter.writeRecords(records);
  return filePath;
}

module.exports = {
  exportTicketsToCSV,
  exportEscalationsToCSV,
  exportSingleTicketToCSV
};
