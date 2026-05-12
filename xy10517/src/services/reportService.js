const { getDB } = require('../database/connection');
const { getUnreturnedLoans, getPartFlow, getLoanDetail } = require('./loanService');
const { getAuditLogs, getAllAuditLogs } = require('../utils/audit');
const { listParts } = require('./partsService');
const dayjs = require('dayjs');

function getInventoryChangeReport() {
  const db = getDB();
  
  const changes = db.prepare(`
    SELECT 
      al.id,
      al.entity_type,
      al.entity_id,
      al.action,
      al.before_value,
      al.after_value,
      al.operator,
      al.reason,
      al.created_at,
      p.part_code,
      p.part_name
    FROM audit_logs al
    LEFT JOIN parts p ON al.entity_id = p.id
    WHERE al.entity_type = 'inventory'
    ORDER BY al.created_at DESC
  `).all().map(log => ({
    ...log,
    before_value: log.before_value ? JSON.parse(log.before_value) : null,
    after_value: log.after_value ? JSON.parse(log.after_value) : null
  }));
  
  return changes;
}

function getStatistics() {
  const db = getDB();
  
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM loans WHERE status = 'borrowed') as borrowed_count,
      (SELECT COUNT(*) FROM loans WHERE status = 'overdue') as overdue_count,
      (SELECT COUNT(*) FROM loans WHERE status = 'partial_returned') as partial_count,
      (SELECT COUNT(*) FROM loans WHERE status = 'returned') as returned_count,
      (SELECT COUNT(*) FROM loans WHERE status = 'consumed') as consumed_count,
      (SELECT COUNT(*) FROM loans WHERE status = 'damaged') as damaged_count,
      (SELECT COUNT(*) FROM loans WHERE status = 'exception') as exception_count,
      (SELECT COUNT(*) FROM parts) as part_count,
      (SELECT COUNT(*) FROM engineers WHERE status = 'active') as active_engineer_count,
      (SELECT COUNT(*) FROM work_orders WHERE status = 'open') as open_workorder_count
  `).get();
  
  return stats;
}

function getUnreturnedSummary() {
  const unreturned = getUnreturnedLoans();
  
  const summary = {
    total_count: unreturned.length,
    by_status: {
      borrowed: unreturned.filter(l => l.status === 'borrowed').length,
      overdue: unreturned.filter(l => l.status === 'overdue').length,
      partial_returned: unreturned.filter(l => l.status === 'partial_returned').length,
      exception: unreturned.filter(l => l.status === 'exception').length
    },
    by_engineer: {},
    by_part: {},
    unbound_workorder: unreturned.filter(l => !l.work_order_id).length,
    closed_workorder_pending: unreturned.filter(l => l.work_order_id && l.work_order_status === 'closed').length,
    overdue_7days_plus: unreturned.filter(l => l.overdue_days > 7).length,
    overdue_30days_plus: unreturned.filter(l => l.overdue_days > 30).length,
    details: unreturned
  };
  
  unreturned.forEach(loan => {
    summary.by_engineer[loan.engineer_name] = (summary.by_engineer[loan.engineer_name] || 0) + 1;
    summary.by_part[loan.part_name] = (summary.by_part[loan.part_name] || 0) + 1;
  });
  
  return summary;
}

function getPartFlowReport(partId) {
  const flow = getPartFlow(partId);
  const audit = getAuditLogs('inventory', partId);
  
  return {
    flow,
    audit,
    events: [
      ...flow.map(f => ({
        type: 'loan',
        time: f.action_at,
        action: f.action_type,
        loan_code: f.loan_code,
        engineer: f.engineer_name,
        work_order: f.order_code,
        quantity: f.item_quantity,
        remark: f.remark
      })),
      ...audit.map(a => ({
        type: 'inventory',
        time: a.created_at,
        action: a.action,
        operator: a.operator,
        before: a.before_value,
        after: a.after_value,
        reason: a.reason
      }))
    ].sort((a, b) => new Date(a.time) - new Date(b.time))
  };
}

function getLoanAuditReport(loanId) {
  const loan = getLoanDetail(loanId);
  if (!loan) {
    return null;
  }
  
  const audit = getAuditLogs('loan', loanId);
  
  return {
    loan,
    audit,
    timeline: audit.map(a => ({
      time: a.created_at,
      action: a.action,
      operator: a.operator,
      before: a.before_value,
      after: a.after_value,
      reason: a.reason
    })).sort((a, b) => new Date(a.time) - new Date(b.time))
  };
}

function getFullAuditReport() {
  const db = getDB();
  
  const audit = getAllAuditLogs(500);
  
  return {
    total_count: audit.length,
    by_action: audit.reduce((acc, item) => {
      acc[item.action] = (acc[item.action] || 0) + 1;
      return acc;
    }, {}),
    by_entity: audit.reduce((acc, item) => {
      acc[item.entity_type] = (acc[item.entity_type] || 0) + 1;
      return acc;
    }, {}),
    by_operator: audit.reduce((acc, item) => {
      acc[item.operator] = (acc[item.operator] || 0) + 1;
      return acc;
    }, {}),
    details: audit
  };
}

function getStockStatusReport() {
  const parts = listParts();
  
  return {
    total_value: parts.reduce((acc, p) => acc + (p.stock_quantity || 0) * (p.price || 0), 0),
    total_count: parts.reduce((acc, p) => acc + (p.stock_quantity || 0), 0),
    low_stock: parts.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)),
    zero_stock: parts.filter(p => (p.stock_quantity || 0) === 0),
    details: parts
  };
}

module.exports = {
  getInventoryChangeReport,
  getStatistics,
  getUnreturnedSummary,
  getPartFlowReport,
  getLoanAuditReport,
  getFullAuditReport,
  getStockStatusReport
};
