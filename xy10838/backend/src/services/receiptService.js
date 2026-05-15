const moment = require('moment');
const { getQuery, allQuery, runQuery, uuid } = require('../database');

const generateReceiptNo = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCP-${dateStr}-${random}`;
};

const generateReceiptContent = async (requestId) => {
  const request = await getQuery('SELECT * FROM deletion_requests WHERE id = ?', [requestId]);
  const tasks = await allQuery(
    `SELECT et.*, dd.name as domain_name 
     FROM execution_tasks et 
     JOIN data_domains dd ON et.domain_id = dd.id 
     WHERE et.request_id = ?`,
    [requestId]
  );

  const totalRecords = tasks.reduce((sum, t) => sum + (t.total_records || 0), 0);
  const processedRecords = tasks.reduce((sum, t) => sum + (t.processed_records || 0), 0);
  const failedRecords = tasks.reduce((sum, t) => sum + (t.failed_records || 0), 0);

  const taskDetails = tasks.map(t => ({
    domain: t.domain_name,
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

const generateReceipt = async (requestId, actor) => {
  const existing = await getQuery('SELECT * FROM customer_receipts WHERE request_id = ?', [requestId]);
  if (existing) {
    throw new Error('回执已存在');
  }

  const request = await getQuery('SELECT * FROM deletion_requests WHERE id = ?', [requestId]);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  const id = uuid();
  const receiptNo = generateReceiptNo();
  const content = await generateReceiptContent(requestId);

  await runQuery(
    `INSERT INTO customer_receipts 
     (id, request_id, receipt_no, status, content, generated_at)
     VALUES (?, ?, ?, 'GENERATED', ?, CURRENT_TIMESTAMP)`,
    [id, requestId, receiptNo, JSON.stringify(content)]
  );

  return await getReceiptById(id);
};

const getReceiptById = async (id) => {
  return await getQuery('SELECT * FROM customer_receipts WHERE id = ?', [id]);
};

const getReceiptByRequestId = async (requestId) => {
  return await getQuery('SELECT * FROM customer_receipts WHERE request_id = ?', [requestId]);
};

const sendReceipt = async (receiptId, actor) => {
  await runQuery(
    `UPDATE customer_receipts SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [receiptId]
  );
  return await getReceiptById(receiptId);
};

const confirmReceipt = async (receiptId, actor) => {
  await runQuery(
    `UPDATE customer_receipts 
     SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [actor, receiptId]
  );
  return await getReceiptById(receiptId);
};

const generateAuditReport = async (requestId) => {
  const request = await getQuery('SELECT * FROM deletion_requests WHERE id = ?', [requestId]);
  const auditLogs = await allQuery('SELECT * FROM audit_logs WHERE request_id = ? ORDER BY created_at', [requestId]);
  const tasks = await allQuery('SELECT * FROM execution_tasks WHERE request_id = ?', [requestId]);
  const failedItems = await allQuery(
    `SELECT fi.*, dd.name as domain_name 
     FROM failed_items fi 
     JOIN execution_tasks et ON fi.task_id = et.id 
     JOIN data_domains dd ON et.domain_id = dd.id 
     WHERE et.request_id = ?`,
    [requestId]
  );

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
      domain: f.domain_name,
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
