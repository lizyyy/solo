const { getDb } = require('../database/init');
const { addHistoryLog } = require('./historyService');

function getDepartments() {
  const db = getDb();
  return db.prepare('SELECT * FROM departments ORDER BY id ASC').all();
}

function matchDepartmentByContent(content) {
  const db = getDb();
  
  const departments = db.prepare('SELECT * FROM departments').all();
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const dept of departments) {
    if (!dept.keywords) continue;
    
    const keywords = dept.keywords.split(/[,，、\s]+/).filter(k => k);
    let score = 0;
    
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        score += 1;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = dept;
    }
  }
  
  return {
    department: bestMatch,
    score: bestScore,
    confidence: departments.length > 0 ? (bestScore > 0 ? 'high' : 'none') : 'none'
  };
}

function assignTicketToDepartment(ticketId, departmentId, operator = 'system', reason = '') {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
  if (!department) {
    throw new Error('部门不存在');
  }
  
  const oldDepartmentId = ticket.assigned_department_id;
  const oldDepartment = oldDepartmentId 
    ? db.prepare('SELECT * FROM departments WHERE id = ?').get(oldDepartmentId)
    : null;
  
  db.prepare(`
    UPDATE tickets 
    SET assigned_department_id = ?, 
        assigned_at = CURRENT_TIMESTAMP,
        status = CASE WHEN status = 'pending' THEN 'assigned' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(departmentId, ticketId);
  
  addHistoryLog(
    db,
    'ticket',
    ticketId,
    'assign_department',
    oldDepartment ? { id: oldDepartment.id, name: oldDepartment.name } : null,
    { id: department.id, name: department.name, reason },
    operator
  );
  
  return {
    ticketId,
    departmentId,
    departmentName: department.name,
    assignedAt: new Date().toISOString()
  };
}

function autoAssignTicket(ticketId, operator = 'system') {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  if (ticket.assigned_department_id) {
    return { alreadyAssigned: true, ticketId, departmentId: ticket.assigned_department_id };
  }
  
  const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(ticket.cluster_id);
  if (!cluster) {
    throw new Error('工单关联的聚类不存在');
  }
  
  const complaints = db.prepare(`
    SELECT c.content FROM cluster_members cm
    JOIN complaints c ON c.id = cm.complaint_id
    WHERE cm.cluster_id = ?
  `).all(cluster.id);
  
  const allContent = complaints.map(c => c.content).join(' ');
  
  const match = matchDepartmentByContent(allContent);
  
  if (match.department) {
    return assignTicketToDepartment(ticketId, match.department.id, operator, `自动匹配: 关键词匹配得分 ${match.score}`);
  }
  
  return {
    ticketId,
    autoAssigned: false,
    reason: '未找到匹配的部门，请手动分派'
  };
}

function autoAssignAllPendingTickets() {
  const db = getDb();
  
  const pendingTickets = db.prepare(`
    SELECT id FROM tickets 
    WHERE status IN ('pending') 
    AND assigned_department_id IS NULL
  `).all();
  
  const results = [];
  
  for (const ticket of pendingTickets) {
    try {
      const result = autoAssignTicket(ticket.id, 'system');
      results.push({ ticketId: ticket.id, ...result });
    } catch (e) {
      results.push({ ticketId: ticket.id, error: e.message });
    }
  }
  
  return {
    totalProcessed: pendingTickets.length,
    successCount: results.filter(r => r.departmentId || r.alreadyAssigned).length,
    results
  };
}

function addReply(ticketId, content, author, isOfficial = false) {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  const latestReply = db.prepare(`
    SELECT MAX(version) as max_version FROM replies WHERE ticket_id = ?
  `).get(ticketId);
  
  const version = (latestReply.max_version || 0) + 1;
  
  const result = db.prepare(`
    INSERT INTO replies (ticket_id, version, content, author, is_official)
    VALUES (?, ?, ?, ?, ?)
  `).run(ticketId, version, content, author, isOfficial ? 1 : 0);
  
  const replyId = result.lastInsertRowid;
  
  addHistoryLog(
    db,
    'ticket',
    ticketId,
    'reply',
    null,
    { replyId, version, content, author, isOfficial },
    author
  );
  
  db.prepare(
    'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(ticketId);
  
  return {
    id: replyId,
    ticketId,
    version,
    content,
    author,
    isOfficial,
    createdAt: new Date().toISOString()
  };
}

function getReplyVersion(ticketId, version) {
  const db = getDb();
  
  return db.prepare(`
    SELECT * FROM replies WHERE ticket_id = ? AND version = ?
  `).get(ticketId, version);
}

function getLatestOfficialReply(ticketId) {
  const db = getDb();
  
  return db.prepare(`
    SELECT * FROM replies 
    WHERE ticket_id = ? AND is_official = 1
    ORDER BY version DESC
    LIMIT 1
  `).get(ticketId);
}

module.exports = {
  getDepartments,
  matchDepartmentByContent,
  assignTicketToDepartment,
  autoAssignTicket,
  autoAssignAllPendingTickets,
  addReply,
  getReplyVersion,
  getLatestOfficialReply
};
