const { getDb } = require('../database/init');
const { addHistoryLog } = require('./historyService');

function checkOverdueTickets() {
  const db = getDb();
  
  const now = new Date().toISOString();
  
  const overdueTickets = db.prepare(`
    SELECT t.*, c.title as cluster_title
    FROM tickets t
    LEFT JOIN clusters c ON c.id = t.cluster_id
    WHERE t.status NOT IN ('closed', 'withdrawn', 'merged')
    AND t.deadline IS NOT NULL
    AND t.deadline < ?
    ORDER BY t.deadline ASC
  `).all(now);
  
  return overdueTickets;
}

function addSupervision(ticketId, level, reason, supervisor = 'system') {
  const db = getDb();
  
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  const validLevels = ['remind', 'warning', 'urgent'];
  if (!validLevels.includes(level)) {
    throw new Error('督办级别无效，应为: remind, warning, urgent');
  }
  
  const result = db.prepare(`
    INSERT INTO supervision_records (ticket_id, level, reason, supervisor)
    VALUES (?, ?, ?, ?)
  `).run(ticketId, level, reason, supervisor);
  
  const supervisionId = result.lastInsertRowid;
  
  addHistoryLog(
    db,
    'ticket',
    ticketId,
    'supervise',
    null,
    { supervisionId, level, reason },
    supervisor
  );
  
  return {
    id: supervisionId,
    ticketId,
    level,
    reason,
    supervisor,
    createdAt: new Date().toISOString()
  };
}

function getSupervisionList(options = {}) {
  const db = getDb();
  const { level = null, includeOverdue = true, page = 1, pageSize = 20 } = options;
  
  let sql = `
    SELECT sr.*, 
           t.ticket_no, t.status as ticket_status, t.deadline,
           c.title as cluster_title,
           d.name as department_name
    FROM supervision_records sr
    JOIN tickets t ON t.id = sr.ticket_id
    LEFT JOIN clusters c ON c.id = t.cluster_id
    LEFT JOIN departments d ON d.id = t.assigned_department_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (level) {
    sql += ' AND sr.level = ?';
    params.push(level);
  }
  
  if (includeOverdue) {
    const now = new Date().toISOString();
    sql += ` OR (t.status NOT IN ('closed', 'withdrawn', 'merged') 
                 AND t.deadline IS NOT NULL 
                 AND t.deadline < ?)`;
    params.push(now);
  }
  
  sql += ' ORDER BY sr.created_at DESC';
  sql += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  
  return db.prepare(sql).all(...params);
}

function getStatistics() {
  const db = getDb();
  
  const totalComplaints = db.prepare(
    'SELECT COUNT(*) as cnt FROM complaints'
  ).get().cnt;
  
  const totalClusters = db.prepare(
    'SELECT COUNT(*) as cnt FROM clusters'
  ).get().cnt;
  
  const clustersWithMultipleComplaints = db.prepare(`
    SELECT COUNT(*) as cnt FROM clusters c
    WHERE (SELECT COUNT(*) FROM cluster_members cm WHERE cm.cluster_id = c.id) > 1
  `).get().cnt;
  
  const totalTickets = db.prepare(
    'SELECT COUNT(*) as cnt FROM tickets'
  ).get().cnt;
  
  const ticketsByStatus = db.prepare(`
    SELECT status, COUNT(*) as cnt 
    FROM tickets 
    GROUP BY status
  `).all();
  
  const ticketsByDepartment = db.prepare(`
    SELECT d.id, d.name, d.code, COUNT(t.id) as ticket_count
    FROM departments d
    LEFT JOIN tickets t ON t.assigned_department_id = d.id
    GROUP BY d.id
    ORDER BY ticket_count DESC
  `).all();
  
  const closedThisWeek = db.prepare(`
    SELECT COUNT(*) as cnt FROM tickets 
    WHERE status = 'closed'
    AND closed_at >= date('now', '-7 days')
  `).get().cnt;
  
  const mergeCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM ticket_merges'
  ).get().cnt;
  
  const supervisionCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM supervision_records'
  ).get().cnt;
  
  const replyCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM replies'
  ).get().cnt;
  
  const officialReplyCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM replies WHERE is_official = 1'
  ).get().cnt;
  
  const historyCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM history_logs'
  ).get().cnt;
  
  const statusMap = {};
  ticketsByStatus.forEach(t => {
    statusMap[t.status] = t.cnt;
  });
  
  return {
    complaints: {
      total: totalComplaints
    },
    clusters: {
      total: totalClusters,
      withMultipleComplaints: clustersWithMultipleComplaints,
      mergeRate: totalClusters > 0 ? (clustersWithMultipleComplaints / totalClusters * 100).toFixed(1) : 0
    },
    tickets: {
      total: totalTickets,
      pending: statusMap.pending || 0,
      assigned: statusMap.assigned || 0,
      merged: statusMap.merged || 0,
      closed: statusMap.closed || 0,
      withdrawn: statusMap.withdrawn || 0,
      closedThisWeek
    },
    departments: ticketsByDepartment,
    operations: {
      merges: mergeCount,
      supervisions: supervisionCount,
      replies: replyCount,
      officialReplies: officialReplyCount
    },
    audit: {
      historyLogs: historyCount
    },
    generatedAt: new Date().toISOString()
  };
}

function getDepartmentPerformance() {
  const db = getDb();
  
  return db.prepare(`
    SELECT 
      d.id,
      d.name,
      d.code,
      COUNT(DISTINCT t.id) as total_tickets,
      COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) as closed_tickets,
      COUNT(DISTINCT CASE 
        WHEN t.status = 'closed' AND t.closed_at <= t.deadline 
        THEN t.id 
      END) as closed_on_time,
      COUNT(DISTINCT CASE 
        WHEN t.status NOT IN ('closed', 'withdrawn', 'merged') 
        AND t.deadline < datetime('now')
        THEN t.id 
      END) as overdue_tickets,
      AVG(CASE 
        WHEN t.status = 'closed' 
        THEN julianday(t.closed_at) - julianday(t.created_at)
        ELSE NULL 
      END) as avg_days_to_close
    FROM departments d
    LEFT JOIN tickets t ON t.assigned_department_id = d.id
    GROUP BY d.id
    ORDER BY total_tickets DESC
  `).all();
}

module.exports = {
  checkOverdueTickets,
  addSupervision,
  getSupervisionList,
  getStatistics,
  getDepartmentPerformance
};
