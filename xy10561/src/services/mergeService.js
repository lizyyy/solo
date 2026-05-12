const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { run, get, all } = require('../models/database');
const { 
  DonationStatus, InvoiceStatus, InvoiceType, 
  MergeRequestStatus, EntityType, ERROR_CODES 
} = require('../utils/states');
const { recordHistory, getMergeRequestHistory } = require('../utils/history');

function generateRequestNo() {
  return `MRG-${moment().format('YYYYMMDDHHmmss')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function getMergeRequest(requestId) {
  const request = get('SELECT * FROM merge_requests WHERE id = ?', [requestId]);
  if (!request) return null;
  
  const items = all(
    'SELECT * FROM merge_request_items WHERE merge_request_id = ? ORDER BY created_at',
    [requestId]
  );

  return {
    ...request,
    items,
    history: getMergeRequestHistory(requestId)
  };
}

function getMergeRequestByNo(requestNo) {
  const request = get('SELECT * FROM merge_requests WHERE request_no = ?', [requestNo]);
  if (!request) return null;
  
  return getMergeRequest(request.id);
}

function getAllMergeRequests(filters = {}) {
  let sql = 'SELECT * FROM merge_requests WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';
  const requests = all(sql, params);

  return requests.map(r => {
    const items = all(
      'SELECT * FROM merge_request_items WHERE merge_request_id = ? ORDER BY created_at',
      [r.id]
    );
    return { ...r, items };
  });
}

function createMergeRequest(options) {
  const {
    donationIds,
    title,
    taxId,
    operator
  } = options;

  if (!donationIds || !Array.isArray(donationIds) || donationIds.length < 2) {
    const error = new Error('At least 2 donation IDs are required for merge');
    error.code = ERROR_CODES.VALIDATION_ERROR;
    error.statusCode = 400;
    throw error;
  }

  if (!title) {
    const error = new Error('Title is required');
    error.code = ERROR_CODES.VALIDATION_ERROR;
    error.statusCode = 400;
    throw error;
  }

  if (!taxId) {
    const error = new Error('Enterprise merge requires tax ID');
    error.code = ERROR_CODES.TAX_ID_MISSING;
    error.statusCode = 400;
    throw error;
  }

  const donations = donationIds.map(id => 
    get('SELECT * FROM donations WHERE id = ?', [id])
  );

  const notFoundIndex = donations.findIndex(d => !d);
  if (notFoundIndex !== -1) {
    const error = new Error(`Donation not found: ${donationIds[notFoundIndex]}`);
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  const unconfirmedIndex = donations.findIndex(d => d.status !== DonationStatus.CONFIRMED);
  if (unconfirmedIndex !== -1) {
    const error = new Error(`Donation ${donationIds[unconfirmedIndex]} is not CONFIRMED`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const projectIds = [...new Set(donations.map(d => d.project_id))];
  if (projectIds.length > 1) {
    const error = new Error('Cannot merge donations from different projects');
    error.code = ERROR_CODES.CROSS_PROJECT_MERGE;
    error.statusCode = 400;
    throw error;
  }

  for (const donation of donations) {
    const existingInvoices = all('SELECT * FROM invoices WHERE donation_id = ?', [donation.id]);
    const activeInvoices = existingInvoices.filter(i => i.status !== InvoiceStatus.CANCELLED);
    
    if (activeInvoices.length > 0) {
      const error = new Error(`Donation ${donation.id} already has an active invoice`);
      error.code = ERROR_CODES.DUPLICATE_INVOICE;
      error.statusCode = 409;
      throw error;
    }
  }

  const id = uuidv4();
  const requestNo = generateRequestNo();
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const status = MergeRequestStatus.PENDING;
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO merge_requests (
      id, request_no, title, tax_id, total_amount, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, requestNo, title, taxId, totalAmount, status, createdAt, createdAt]
  );

  for (const donation of donations) {
    const itemId = uuidv4();
    run(
      `INSERT INTO merge_request_items (
        id, merge_request_id, donation_id, project_id, amount, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [itemId, id, donation.id, donation.project_id, donation.amount, createdAt]
    );
  }

  const mergeRequest = getMergeRequest(id);

  recordHistory({
    entityType: EntityType.MERGE_REQUEST,
    entityId: id,
    action: 'CREATE',
    toStatus: status,
    afterData: mergeRequest,
    operator: operator || 'SYSTEM',
    reason: 'Merge request created'
  });

  return mergeRequest;
}

function processMergeRequest(requestId, options = {}) {
  const request = get('SELECT * FROM merge_requests WHERE id = ?', [requestId]);
  if (!request) {
    const error = new Error('Merge request not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== MergeRequestStatus.PENDING) {
    const error = new Error(`Cannot process merge request in ${request.status} status`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const beforeData = { ...request };
  
  const processingStatus = MergeRequestStatus.PROCESSING;
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
  
  run(
    'UPDATE merge_requests SET status = ?, updated_at = ? WHERE id = ?',
    [processingStatus, updatedAt, requestId]
  );

  recordHistory({
    entityType: EntityType.MERGE_REQUEST,
    entityId: requestId,
    action: 'PROCESS_START',
    fromStatus: request.status,
    toStatus: processingStatus,
    beforeData,
    afterData: { ...request, status: processingStatus },
    operator: options.operator || 'SYSTEM',
    reason: 'Starting merge processing'
  });

  const items = all(
    'SELECT * FROM merge_request_items WHERE merge_request_id = ?',
    [requestId]
  );

  const invoiceId = uuidv4();
  const invoiceNo = `INV-MRG-${moment().format('YYYYMMDDHHmmss')}`;
  const invoiceStatus = InvoiceStatus.DRAFT;

  run(
    `INSERT INTO invoices (
      id, donation_id, invoice_no, invoice_type, title, tax_id,
      amount, status, merge_request_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId, items[0].donation_id, invoiceNo, InvoiceType.ENTERPRISE,
      request.title, request.tax_id, request.total_amount, invoiceStatus,
      requestId, updatedAt, updatedAt
    ]
  );

  const completedStatus = MergeRequestStatus.COMPLETED;
  run(
    'UPDATE merge_requests SET status = ?, merged_invoice_id = ?, updated_at = ? WHERE id = ?',
    [completedStatus, invoiceId, updatedAt, requestId]
  );

  const updatedRequest = getMergeRequest(requestId);

  recordHistory({
    entityType: EntityType.MERGE_REQUEST,
    entityId: requestId,
    action: 'PROCESS_COMPLETE',
    fromStatus: processingStatus,
    toStatus: completedStatus,
    beforeData: { ...request, status: processingStatus },
    afterData: updatedRequest,
    operator: options.operator || 'SYSTEM',
    reason: 'Merge processed successfully'
  });

  return updatedRequest;
}

function failMergeRequest(requestId, errorCode, errorMessage, options = {}) {
  const request = get('SELECT * FROM merge_requests WHERE id = ?', [requestId]);
  if (!request) {
    const error = new Error('Merge request not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  const beforeData = { ...request };
  const newStatus = MergeRequestStatus.FAILED;
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    'UPDATE merge_requests SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, updatedAt, requestId]
  );

  const updatedRequest = getMergeRequest(requestId);

  recordHistory({
    entityType: EntityType.MERGE_REQUEST,
    entityId: requestId,
    action: 'FAIL',
    fromStatus: request.status,
    toStatus: newStatus,
    beforeData,
    afterData: updatedRequest,
    operator: options.operator || 'SYSTEM',
    reason: errorMessage,
    errorCode,
    errorMessage
  });

  return updatedRequest;
}

module.exports = {
  getMergeRequest,
  getMergeRequestByNo,
  getAllMergeRequests,
  createMergeRequest,
  processMergeRequest,
  failMergeRequest
};
