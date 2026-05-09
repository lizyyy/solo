const { getDb } = require('../database/init');
const { addHistoryLog } = require('./historyService');
const { findPrimaryKeyword } = require('./clusterService');

function generateTicketNo() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  
  const db = getDb();
  const todayTickets = db.prepare(
    "SELECT COUNT(*) as cnt FROM tickets WHERE ticket_no LIKE ?"
  ).get(`TK${dateStr}%`);
  
  const seq = (todayTickets.cnt + 1).toString().padStart(4, '0');
  return `TK${dateStr}${seq}`;
}

function createTicketFromCluster(clusterId) {
  const db = getDb();
  
  const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(clusterId);
  if (!cluster) {
    throw new Error('聚类不存在');
  }
  
  const existingTicket = db.prepare(
    'SELECT * FROM tickets WHERE cluster_id = ?'
  ).get(clusterId);
  
  if (existingTicket) {
    return { ticket: existingTicket, isNew: false };
  }
  
  const members = db.prepare(`
    SELECT c.* FROM cluster_members cm
    JOIN complaints c ON c.id = cm.complaint_id
    WHERE cm.cluster_id = ?
    ORDER BY c.created_at ASC
  `).all(clusterId);
  
  if (members.length === 0) {
    throw new Error('聚类中没有投诉记录');
  }
  
  const ticketNo = generateTicketNo();
  
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  
  const result = db.prepare(`
    INSERT INTO tickets (ticket_no, cluster_id, status, deadline)
    VALUES (?, ?, 'pending', ?)
  `).run(ticketNo, clusterId, deadline.toISOString());
  
  const ticketId = result.lastInsertRowid;
  
  addHistoryLog(
    db,
    'ticket',
    ticketId,
    'create_ticket',
    null,
    { ticketNo, clusterId, memberCount: members.length },
    'system'
  );
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  
  return { ticket, isNew: true };
}

function createTicketsFromAllClusters() {
  const db = getDb();
  
  const clusters = db.prepare(`
    SELECT c.* FROM clusters c
    WHERE NOT EXISTS (
      SELECT 1 FROM tickets t WHERE t.cluster_id = c.id
    )
  `).all();
  
  const createdTickets = [];
  
  for (const cluster of clusters) {
    const { ticket, isNew } = createTicketFromCluster(cluster.id);
    if (isNew) {
      createdTickets.push(ticket);
    }
  }
  
  return {
    createdCount: createdTickets.length,
    tickets: createdTickets
  };
}

function mergeTickets(targetTicketId, sourceTicketId, reason = '', operator = 'system') {
  const db = getDb();
  
  if (targetTicketId === sourceTicketId) {
    throw new Error('不能将工单合并到自身');
  }
  
  const targetTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(targetTicketId);
  const sourceTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(sourceTicketId);
  
  if (!targetTicket || !sourceTicket) {
    throw new Error('工单不存在');
  }
  
  if (['closed', 'withdrawn'].includes(sourceTicket.status)) {
    throw new Error('源工单已办结或撤回，无法合并');
  }
  
  const sourceCluster = db.prepare(
    'SELECT * FROM clusters WHERE id = ?'
  ).get(sourceTicket.cluster_id);
  
  if (sourceCluster) {
    db.prepare(
      'UPDATE cluster_members SET cluster_id = ? WHERE cluster_id = ?'
    ).run(targetTicket.cluster_id, sourceCluster.id);
    
    db.prepare(
      'UPDATE tickets SET cluster_id = ? WHERE cluster_id = ?'
    ).run(targetTicket.cluster_id, sourceCluster.id);
    
    db.prepare('DELETE FROM clusters WHERE id = ?').run(sourceCluster.id);
  }
  
  db.prepare(`
    INSERT INTO ticket_merges (target_ticket_id, source_ticket_id, merge_reason)
    VALUES (?, ?, ?)
  `).run(targetTicketId, sourceTicketId, reason);
  
  const oldStatus = sourceTicket.status;
  db.prepare(`
    UPDATE tickets 
    SET status = 'merged', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(sourceTicketId);
  
  db.prepare(`
    UPDATE tickets 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(targetTicketId);
  
  addHistoryLog(
    db,
    'ticket',
    sourceTicketId,
    'merge',
    { status: oldStatus },
    { status: 'merged', mergedInto: targetTicketId, reason },
    operator
  );
  
  addHistoryLog(
    db,
    'ticket',
    targetTicketId,
    'merge',
    null,
    { mergedSource: sourceTicketId, reason },
    operator
  );
  
  return {
    targetTicketId,
    sourceTicketId,
    mergedAt: new Date().toISOString()
  };
}

function getTickets(options = {}) {
  const db = getDb();
  const { 
    status = null, 
    departmentId = null, 
    page = 1, 
    pageSize = 20,
    includeCluster = true,
    includeComplaints = false
  } = options;
  
  let sql = `SELECT * FROM tickets WHERE 1=1`;
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  if (departmentId) {
    sql += ' AND assigned_department_id = ?';
    params.push(departmentId);
  }
  
  sql += ' ORDER BY updated_at DESC, created_at DESC';
  sql += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  
  const tickets = db.prepare(sql).all(...params);
  
  if (includeCluster) {
    for (const ticket of tickets) {
      ticket.cluster = db.prepare(
        'SELECT * FROM clusters WHERE id = ?'
      ).get(ticket.cluster_id);
      
      if (ticket.cluster) {
        ticket.cluster.memberCount = db.prepare(
          'SELECT COUNT(*) as cnt FROM cluster_members WHERE cluster_id = ?'
        ).get(ticket.cluster_id).cnt;
      }
      
      if (ticket.assigned_department_id) {
        ticket.department = db.prepare(
          'SELECT * FROM departments WHERE id = ?'
        ).get(ticket.assigned_department_id);
      }
      
      ticket.replyCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM replies WHERE ticket_id = ?'
      ).get(ticket.id).cnt;
      
      ticket.supervisionCount = db.prepare(
        'SELECT COUNT(*) as cnt FROM supervision_records WHERE ticket_id = ?'
      ).get(ticket.id).cnt;
      
      if (includeComplaints && ticket.cluster_id) {
        ticket.complaints = db.prepare(`
          SELECT c.* FROM cluster_members cm
          JOIN complaints c ON c.id = cm.complaint_id
          WHERE cm.cluster_id = ?
          ORDER BY c.created_at ASC
        `).all(ticket.cluster_id);
      }
    }
  }
  
  return tickets;
}

function getTicketById(ticketId) {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return null;
  
  ticket.cluster = db.prepare(
    'SELECT * FROM clusters WHERE id = ?'
  ).get(ticket.cluster_id);
  
  if (ticket.cluster) {
    ticket.cluster.members = db.prepare(`
      SELECT c.* FROM cluster_members cm
      JOIN complaints c ON c.id = cm.complaint_id
      WHERE cm.cluster_id = ?
      ORDER BY c.created_at ASC
    `).all(ticket.cluster_id);
  }
  
  if (ticket.assigned_department_id) {
    ticket.department = db.prepare(
      'SELECT * FROM departments WHERE id = ?'
    ).get(ticket.assigned_department_id);
  }
  
  ticket.replies = db.prepare(`
    SELECT * FROM replies 
    WHERE ticket_id = ? 
    ORDER BY version DESC, created_at DESC
  `).all(ticketId);
  
  ticket.supervisions = db.prepare(`
    SELECT * FROM supervision_records 
    WHERE ticket_id = ? 
    ORDER BY created_at DESC
  `).all(ticketId);
  
  ticket.mergeHistory = db.prepare(`
    SELECT tm.*, t.ticket_no as source_ticket_no
    FROM ticket_merges tm
    LEFT JOIN tickets t ON t.id = tm.source_ticket_id
    WHERE tm.target_ticket_id = ?
    ORDER BY tm.merged_at DESC
  `).all(ticketId);
  
  return ticket;
}

function closeTicket(ticketId, closedBy = 'system') {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  if (ticket.status === 'closed') {
    return { alreadyClosed: true, ticketId };
  }
  
  const oldStatus = ticket.status;
  
  db.prepare(`
    UPDATE tickets 
    SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(closedBy, ticketId);
  
  addHistoryLog(
    db,
    'ticket',
    ticketId,
    'close',
    { status: oldStatus },
    { status: 'closed', closedBy },
    closedBy
  );
  
  return {
    ticketId,
    closedAt: new Date().toISOString(),
    closedBy
  };
}

function withdrawTicket(ticketId, operator = 'system') {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  if (['closed', 'withdrawn'].includes(ticket.status)) {
    throw new Error('工单已办结或撤回');
  }
  
  const oldStatus = ticket.status;
  
  db.prepare(`
    UPDATE tickets 
    SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(ticketId);
  
  addHistoryLog(
    db,
    'ticket',
    ticketId,
    'withdraw',
    { status: oldStatus },
    { status: 'withdrawn' },
    operator
  );
  
  return {
    ticketId,
    withdrawnAt: new Date().toISOString(),
    operator
  };
}

function createComplaint(data) {
  const db = getDb();
  
  const {
    citizen_name,
    citizen_phone,
    content,
    area = null,
    location = null,
    category = null,
    urgency_level = 'normal',
    created_at = null
  } = data;
  
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  
  const todayComplaints = db.prepare(
    "SELECT COUNT(*) as cnt FROM complaints WHERE complaint_no LIKE ?"
  ).get(`CP${dateStr}%`);
  
  const seq = (todayComplaints.cnt + 1).toString().padStart(4, '0');
  const complaintNo = `CP${dateStr}${seq}`;
  
  const createdAt = created_at || new Date().toISOString();
  
  const result = db.prepare(`
    INSERT INTO complaints (complaint_no, citizen_name, citizen_phone, content,
                            area, location, category, urgency_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    complaintNo,
    citizen_name,
    citizen_phone,
    content,
    area,
    location,
    category,
    urgency_level,
    createdAt,
    createdAt
  );
  
  const complaintId = result.lastInsertRowid;
  
  addHistoryLog(
    db,
    'complaint',
    complaintId,
    'create',
    null,
    { complaintNo, citizen_name, content },
    'system'
  );
  
  return db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
}

function batchCreateComplaints(complaintsData) {
  const created = [];
  
  for (const data of complaintsData) {
    const complaint = createComplaint(data);
    created.push(complaint);
  }
  
  return created;
}

module.exports = {
  generateTicketNo,
  createTicketFromCluster,
  createTicketsFromAllClusters,
  mergeTickets,
  getTickets,
  getTicketById,
  closeTicket,
  withdrawTicket,
  createComplaint,
  batchCreateComplaints
};
