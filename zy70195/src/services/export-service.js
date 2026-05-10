const { getDb } = require('../database');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

function ensureExportDir() {
  const exportDir = path.join(__dirname, '..', '..', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  return exportDir;
}

async function exportQualificationReview() {
  const db = getDb();
  const exportDir = ensureExportDir();
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  
  const data = await db.all(`
    SELECT 
      q.id as qualification_id,
      s.id as supplier_id,
      s.name as supplier_name,
      s.status as supplier_status,
      q.type as qualification_type,
      q.name as qualification_name,
      q.certificate_no,
      q.effective_date,
      q.expiry_date,
      q.status as qualification_status,
      CASE 
        WHEN q.status = 'expired' THEN '已过期'
        WHEN julianday(q.expiry_date) - julianday('now') <= 30 THEN '即将到期(30天内)'
        WHEN julianday(q.expiry_date) - julianday('now') <= 90 THEN '即将到期(90天内)'
        ELSE '正常'
      END as risk_level,
      CAST(julianday(q.expiry_date) - julianday('now') AS INTEGER) as days_remaining,
      q.created_at,
      q.updated_at
    FROM qualifications q
    JOIN suppliers s ON q.supplier_id = s.id
    ORDER BY 
      CASE q.status WHEN 'expired' THEN 1 ELSE 2 END,
      days_remaining ASC,
      s.name ASC
  `);
  
  const fields = [
    'supplier_name', 'supplier_status',
    'qualification_type', 'qualification_name', 'certificate_no',
    'effective_date', 'expiry_date', 'qualification_status',
    'risk_level', 'days_remaining',
    'qualification_id', 'supplier_id',
    'created_at', 'updated_at'
  ];
  
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  const filename = `资质复核_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, '\ufeff' + csv);
  
  const summary = {
    total: data.length,
    expired: data.filter(d => d.qualification_status === 'expired').length,
    warning_30: data.filter(d => d.days_remaining > 0 && d.days_remaining <= 30).length,
    warning_90: data.filter(d => d.days_remaining > 30 && d.days_remaining <= 90).length,
    normal: data.filter(d => d.days_remaining > 90).length
  };
  
  return {
    filepath,
    filename,
    summary,
    data
  };
}

async function exportFreezeReview() {
  const db = getDb();
  const exportDir = ensureExportDir();
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  
  const data = await db.all(`
    SELECT 
      fl.id as log_id,
      s.id as supplier_id,
      s.name as supplier_name,
      s.status as current_status,
      fl.action,
      fl.reason,
      q.name as qualification_name,
      q.expiry_date,
      fl.created_at as action_time
    FROM freeze_logs fl
    JOIN suppliers s ON fl.supplier_id = s.id
    LEFT JOIN qualifications q ON fl.qualification_id = q.id
    ORDER BY fl.created_at DESC
  `);
  
  const fields = [
    'supplier_name', 'current_status',
    'action', 'reason',
    'qualification_name', 'expiry_date',
    'action_time',
    'supplier_id', 'log_id'
  ];
  
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  const filename = `冻结记录复核_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, '\ufeff' + csv);
  
  const actionCounts = {};
  data.forEach(d => {
    actionCounts[d.action] = (actionCounts[d.action] || 0) + 1;
  });
  
  return {
    filepath,
    filename,
    summary: {
      total: data.length,
      by_action: actionCounts
    },
    data
  };
}

async function exportOrderReview() {
  const db = getDb();
  const exportDir = ensureExportDir();
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  
  const data = await db.all(`
    SELECT 
      o.id as order_id,
      o.order_no,
      s.id as supplier_id,
      s.name as supplier_name,
      s.status as supplier_status,
      o.amount,
      o.status as order_status,
      CASE o.status
        WHEN 'pending' THEN '待处理'
        WHEN 'blocked' THEN '被拦截'
        WHEN 'frozen' THEN '已冻结'
        WHEN 'approved' THEN '已通过'
        WHEN 'rejected' THEN '已拒绝'
        WHEN 'completed' THEN '已完成'
        ELSE o.status
      END as order_status_desc,
      o.freeze_reason,
      o.created_at,
      o.updated_at
    FROM orders o
    JOIN suppliers s ON o.supplier_id = s.id
    ORDER BY o.created_at DESC
  `);
  
  const fields = [
    'order_no', 'supplier_name', 'supplier_status',
    'amount', 'order_status', 'order_status_desc',
    'freeze_reason',
    'created_at', 'updated_at',
    'order_id', 'supplier_id'
  ];
  
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  const filename = `订单复核_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, '\ufeff' + csv);
  
  const statusCounts = {};
  let totalAmount = 0;
  let blockedAmount = 0;
  
  data.forEach(d => {
    statusCounts[d.order_status_desc] = (statusCounts[d.order_status_desc] || 0) + 1;
    totalAmount += d.amount || 0;
    if (d.order_status === 'blocked' || d.order_status === 'frozen') {
      blockedAmount += d.amount || 0;
    }
  });
  
  return {
    filepath,
    filename,
    summary: {
      total_orders: data.length,
      total_amount: totalAmount,
      blocked_frozen_amount: blockedAmount,
      by_status: statusCounts
    },
    data
  };
}

async function exportRiskReview() {
  const db = getDb();
  const exportDir = ensureExportDir();
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  
  const data = await db.all(`
    SELECT 
      rl.id as risk_id,
      s.id as supplier_id,
      s.name as supplier_name,
      s.status as supplier_status,
      rl.risk_type,
      rl.description,
      CASE rl.severity
        WHEN 'critical' THEN '严重'
        WHEN 'high' THEN '高'
        WHEN 'medium' THEN '中'
        WHEN 'low' THEN '低'
        ELSE rl.severity
      END as severity_desc,
      CASE rl.status
        WHEN 'active' THEN '活跃'
        WHEN 'resolved' THEN '已解决'
        ELSE rl.status
      END as risk_status,
      rl.created_at,
      rl.updated_at
    FROM risk_list rl
    JOIN suppliers s ON rl.supplier_id = s.id
    ORDER BY 
      CASE rl.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END,
      rl.created_at DESC
  `);
  
  const fields = [
    'supplier_name', 'supplier_status',
    'risk_type', 'description',
    'severity_desc', 'risk_status',
    'created_at', 'updated_at',
    'risk_id', 'supplier_id'
  ];
  
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  const filename = `风险清单复核_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, '\ufeff' + csv);
  
  const activeCount = data.filter(d => d.risk_status === '活跃').length;
  const bySeverity = {};
  data.forEach(d => {
    bySeverity[d.severity_desc] = (bySeverity[d.severity_desc] || 0) + 1;
  });
  
  return {
    filepath,
    filename,
    summary: {
      total: data.length,
      active: activeCount,
      by_severity: bySeverity
    },
    data
  };
}

async function exportExceptionReview() {
  const db = getDb();
  const exportDir = ensureExportDir();
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  
  const data = await db.all(`
    SELECT 
      er.id as exception_id,
      er.type as exception_type,
      er.severity,
      er.supplier_id,
      er.qualification_id,
      er.order_id,
      er.endpoint,
      er.method,
      er.error,
      er.raw_data,
      CASE er.status
        WHEN 'pending' THEN '待处理'
        WHEN 'handled' THEN '已处理'
        ELSE er.status
      END as exception_status,
      er.created_at,
      er.handled_at,
      er.handled_by,
      er.handling_notes
    FROM exception_records er
    ORDER BY 
      CASE er.status WHEN 'pending' THEN 1 ELSE 2 END,
      CASE er.severity 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        ELSE 3 
      END,
      er.created_at DESC
  `);
  
  const fields = [
    'exception_type', 'severity',
    'exception_status',
    'supplier_id', 'qualification_id', 'order_id',
    'endpoint', 'method', 'error',
    'created_at', 'handled_at', 'handled_by',
    'handling_notes',
    'exception_id'
  ];
  
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  const filename = `异常记录复核_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);
  fs.writeFileSync(filepath, '\ufeff' + csv);
  
  const pendingCount = data.filter(d => d.exception_status === '待处理').length;
  const byType = {};
  data.forEach(d => {
    byType[d.exception_type] = (byType[d.exception_type] || 0) + 1;
  });
  
  return {
    filepath,
    filename,
    summary: {
      total: data.length,
      pending: pendingCount,
      by_type: byType
    },
    data
  };
}

async function exportFullReview() {
  const results = {
    qualifications: await exportQualificationReview(),
    freeze_logs: await exportFreezeReview(),
    orders: await exportOrderReview(),
    risks: await exportRiskReview(),
    exceptions: await exportExceptionReview()
  };
  
  const summary = {
    generated_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    qualifications: results.qualifications.summary,
    freeze_logs: results.freeze_logs.summary,
    orders: results.orders.summary,
    risks: results.risks.summary,
    exceptions: results.exceptions.summary
  };
  
  const exportDir = ensureExportDir();
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const summaryFile = path.join(exportDir, `复核汇总_${timestamp}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  return {
    summary_file: summaryFile,
    files: {
      qualifications: results.qualifications.filename,
      freeze_logs: results.freeze_logs.filename,
      orders: results.orders.filename,
      risks: results.risks.filename,
      exceptions: results.exceptions.filename
    },
    summary
  };
}

module.exports = {
  exportQualificationReview,
  exportFreezeReview,
  exportOrderReview,
  exportRiskReview,
  exportExceptionReview,
  exportFullReview
};
