const moment = require('moment');
const { db, uuid, getNow, saveDatabase } = require('../database');
const { createAuditLog } = require('./deletionService');

const generateReceiptNo = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCP-${dateStr}-${random}`;
};

const generateReceiptContent = (requestId) => {
  const request = db.deletion_requests.find(r => r.id === requestId);
  const tasks = db.execution_tasks.filter(t => t.request_id === requestId);
  const domainMap = {};
  db.data_domains.forEach(d => { domainMap[d.id] = d.name; });

  const totalRecords = tasks.reduce((sum, t) => sum + (t.total_records || 0), 0);
  const processedRecords = tasks.reduce((sum, t) => sum + (t.processed_records || 0), 0);
  const failedRecords = tasks.reduce((sum, t) => sum + (t.failed_records || 0), 0);

  const taskDetails = tasks.map(t => ({
    domain: domainMap[t.domain_id] || t.domain_id,
    status: t.status,
    total: t.total_records,
    processed: t.processed_records,
    failed: t.failed_records
  }));

  return {
    requestNo: request.request_no,
    customerId: request.customer_id,
    customerName: request.customer_name,
    generatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
    summary: {
      totalRecords,
      processedRecords,
      failedRecords,
      successRate: totalRecords > 0 ? ((processedRecords / totalRecords) * 100).toFixed(2) : 0
    },
    tasks: taskDetails,
    executedBy: request.executed_by,
    executedAt: request.executed_at
  };
};

const generateReceipt = (requestId, actor) => {
  const existing = db.customer_receipts.find(r => r.request_id === requestId);
  if (existing) {
    throw new Error('回执已存在');
  }

  const request = db.deletion_requests.find(r => r.id === requestId);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  const id = uuid();
  const receiptNo = generateReceiptNo();
  const content = generateReceiptContent(requestId);

  const receipt = {
    id,
    request_id: requestId,
    receipt_no: receiptNo,
    status: 'GENERATED',
    content: JSON.stringify(content),
    generated_at: getNow(),
    created_at: getNow()
  };
  
  db.customer_receipts.push(receipt);
  
  createAuditLog({
    requestId,
    action: 'RECEIPT_GENERATED',
    actor,
    details: `生成回执 ${receiptNo}`
  });
  
  saveDatabase();
  return receipt;
};

const getReceiptById = (id) => {
  return db.customer_receipts.find(r => r.id === id);
};

const getReceiptByRequestId = (requestId) => {
  return db.customer_receipts.find(r => r.request_id === requestId);
};

const sendReceipt = (receiptId, actor) => {
  const receipt = db.customer_receipts.find(r => r.id === receiptId);
  if (receipt) {
    receipt.status = 'SENT';
    receipt.sent_at = getNow();
    
    createAuditLog({
      requestId: receipt.request_id,
      action: 'RECEIPT_SENT',
      actor,
      details: `回执 ${receipt.receipt_no} 已发送给客户`
    });
    
    saveDatabase();
  }
  return receipt;
};

const confirmReceipt = (receiptId, actor) => {
  const receipt = db.customer_receipts.find(r => r.id === receiptId);
  if (receipt) {
    receipt.status = 'CONFIRMED';
    receipt.confirmed_by = actor;
    receipt.confirmed_at = getNow();
    
    createAuditLog({
      requestId: receipt.request_id,
      action: 'RECEIPT_CONFIRMED',
      actor,
      details: `回执 ${receipt.receipt_no} 已被客户确认`
    });
    
    saveDatabase();
  }
  return receipt;
};

const generateAuditReport = (requestId) => {
  const request = db.deletion_requests.find(r => r.id === requestId);
  const auditLogs = db.audit_logs.filter(l => l.request_id === requestId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const tasks = db.execution_tasks.filter(t => t.request_id === requestId);
  const failedItems = db.failed_items.filter(f => 
    tasks.some(t => t.id === f.task_id)
  );
  const domainMap = {};
  db.data_domains.forEach(d => { domainMap[d.id] = d.name; });

  return {
    reportType: 'DELETION_AUDIT_REPORT',
    requestNo: request.request_no,
    generatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
    request: {
      customerId: request.customer_id,
      customerName: request.customer_name,
      reason: request.reason,
      status: request.status,
      requestedBy: request.requested_by,
      requestedAt: request.requested_at,
      approvedBy: request.approved_by,
      approvedAt: request.approved_at
    },
    tasks: tasks.map(t => ({
      domainId: t.domain_id,
      status: t.status,
      totalRecords: t.total_records,
      processedRecords: t.processed_records,
      failedRecords: t.failed_records,
      retryCount: t.retry_count
    })),
    failedItems: failedItems.map(f => ({
      domain: domainMap[db.execution_tasks.find(t => t.id === f.task_id)?.domain_id] || f.task_id,
      recordId: f.record_id,
      errorCode: f.error_code,
      errorMessage: f.error_message,
      status: f.status
    })),
    auditTrail: auditLogs.map(log => ({
      action: log.action,
      actor: log.actor,
      timestamp: log.created_at,
      details: log.details,
      beforeState: log.before_state ? JSON.parse(log.before_state) : null,
      afterState: log.after_state ? JSON.parse(log.after_state) : null
    }))
  };
};

module.exports = {
  generateReceipt,
  getReceiptById,
  getReceiptByRequestId,
  sendReceipt,
  confirmReceipt,
  generateAuditReport,
  generateReceiptNo
};
