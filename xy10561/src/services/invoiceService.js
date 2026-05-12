const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { run, get, all } = require('../models/database');
const { DonationStatus, InvoiceStatus, InvoiceType, EntityType, ERROR_CODES } = require('../utils/states');
const { recordHistory, getInvoiceHistory } = require('../utils/history');

function generateInvoiceNo() {
  return `INV-${moment().format('YYYYMMDDHHmmss')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function getInvoice(invoiceId) {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) return null;
  
  return {
    ...invoice,
    history: getInvoiceHistory(invoiceId)
  };
}

function getInvoiceByNo(invoiceNo) {
  const invoice = get('SELECT * FROM invoices WHERE invoice_no = ?', [invoiceNo]);
  if (!invoice) return null;
  
  return {
    ...invoice,
    history: getInvoiceHistory(invoice.id)
  };
}

function getInvoicesByDonation(donationId) {
  return all('SELECT * FROM invoices WHERE donation_id = ? ORDER BY created_at DESC', [donationId]);
}

function getAllInvoices(filters = {}) {
  let sql = 'SELECT * FROM invoices WHERE 1=1';
  const params = [];

  if (filters.donationId) {
    sql += ' AND donation_id = ?';
    params.push(filters.donationId);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.invoiceType) {
    sql += ' AND invoice_type = ?';
    params.push(filters.invoiceType);
  }

  sql += ' ORDER BY created_at DESC';
  return all(sql, params);
}

function applyForInvoice(options) {
  const {
    donationId,
    invoiceType,
    title,
    taxId,
    operator
  } = options;

  if (!donationId || !invoiceType || !title) {
    const error = new Error('Missing required fields: donationId, invoiceType, title');
    error.code = ERROR_CODES.VALIDATION_ERROR;
    error.statusCode = 400;
    throw error;
  }

  const donation = get('SELECT * FROM donations WHERE id = ?', [donationId]);
  if (!donation) {
    const error = new Error('Donation not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (donation.status !== DonationStatus.CONFIRMED) {
    const error = new Error(`Cannot apply for invoice. Donation status is ${donation.status}, required CONFIRMED.`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const existingInvoices = getInvoicesByDonation(donationId);
  const activeInvoices = existingInvoices.filter(i => i.status !== InvoiceStatus.CANCELLED);
  
  if (activeInvoices.length > 0) {
    const error = new Error(`Invoice already exists for this donation. Invoice ID: ${activeInvoices[0].id}`);
    error.code = ERROR_CODES.DUPLICATE_INVOICE;
    error.statusCode = 409;
    throw error;
  }

  if (invoiceType === InvoiceType.ENTERPRISE && !taxId) {
    const error = new Error('Enterprise invoice requires tax ID');
    error.code = ERROR_CODES.TAX_ID_MISSING;
    error.statusCode = 400;
    throw error;
  }

  const id = uuidv4();
  const invoiceNo = generateInvoiceNo();
  const status = InvoiceStatus.DRAFT;
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO invoices (
      id, donation_id, invoice_no, invoice_type, title, tax_id,
      amount, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, donationId, invoiceNo, invoiceType, title, taxId,
      donation.amount, status, createdAt, createdAt
    ]
  );

  const invoice = getInvoice(id);

  recordHistory({
    entityType: EntityType.INVOICE,
    entityId: id,
    action: 'CREATE',
    toStatus: status,
    afterData: invoice,
    operator: operator || 'SYSTEM',
    reason: 'Invoice application submitted'
  });

  return invoice;
}

function issueInvoice(invoiceId, options = {}) {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (invoice.status !== InvoiceStatus.DRAFT) {
    const error = new Error(`Cannot issue invoice in ${invoice.status} status`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const beforeData = { ...invoice };
  const newStatus = InvoiceStatus.ISSUED;
  const downloadUrl = `/api/invoices/${invoiceId}/download`;
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    'UPDATE invoices SET status = ?, download_url = ?, updated_at = ? WHERE id = ?',
    [newStatus, downloadUrl, updatedAt, invoiceId]
  );

  const updatedInvoice = getInvoice(invoiceId);

  recordHistory({
    entityType: EntityType.INVOICE,
    entityId: invoiceId,
    action: 'ISSUE',
    fromStatus: invoice.status,
    toStatus: newStatus,
    beforeData,
    afterData: updatedInvoice,
    operator: options.operator || 'SYSTEM',
    reason: options.reason || 'Invoice issued successfully'
  });

  return updatedInvoice;
}

function cancelInvoice(invoiceId, options = {}) {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    const error = new Error('Invoice is already cancelled');
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const validStatuses = [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.USED];
  if (!validStatuses.includes(invoice.status)) {
    const error = new Error(`Cannot cancel invoice in ${invoice.status} status`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const beforeData = { ...invoice };
  const newStatus = InvoiceStatus.CANCELLED;
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    'UPDATE invoices SET status = ?, download_url = NULL, updated_at = ? WHERE id = ?',
    [newStatus, updatedAt, invoiceId]
  );

  const updatedInvoice = getInvoice(invoiceId);

  recordHistory({
    entityType: EntityType.INVOICE,
    entityId: invoiceId,
    action: 'CANCEL',
    fromStatus: invoice.status,
    toStatus: newStatus,
    beforeData,
    afterData: updatedInvoice,
    operator: options.operator || 'SYSTEM',
    reason: options.reason || 'Invoice cancelled'
  });

  return updatedInvoice;
}

function downloadInvoice(invoiceId) {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    const error = new Error('Cannot download cancelled invoice');
    error.code = ERROR_CODES.CANCELLED_INVOICE_DOWNLOAD;
    error.statusCode = 400;
    throw error;
  }

  if (invoice.status === InvoiceStatus.DRAFT) {
    const error = new Error('Cannot download draft invoice. Please issue it first.');
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  recordHistory({
    entityType: EntityType.INVOICE,
    entityId: invoiceId,
    action: 'DOWNLOAD',
    fromStatus: invoice.status,
    toStatus: invoice.status,
    beforeData: invoice,
    afterData: invoice,
    operator: 'SYSTEM',
    reason: 'Invoice downloaded'
  });

  return {
    ...invoice,
    downloadContent: `INVOICE CONTENT\nInvoice No: ${invoice.invoice_no}\nTitle: ${invoice.title}\nAmount: ${invoice.amount}\nDate: ${invoice.created_at}`
  };
}

function correctInvoice(invoiceId, updates, options = {}) {
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    const error = new Error('Cannot correct cancelled invoice');
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const allowedFields = ['title', 'tax_id'];
  const beforeData = { ...invoice };
  const updateFields = [];
  const updateValues = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateValues.push(updates[field]);
    }
  }

  if (updateFields.length === 0) {
    const error = new Error('No valid fields to update');
    error.code = ERROR_CODES.VALIDATION_ERROR;
    error.statusCode = 400;
    throw error;
  }

  updateValues.push(moment().format('YYYY-MM-DD HH:mm:ss'));
  updateValues.push(invoiceId);

  run(
    `UPDATE invoices SET ${updateFields.join(', ')}, updated_at = ? WHERE id = ?`,
    updateValues
  );

  const updatedInvoice = getInvoice(invoiceId);

  recordHistory({
    entityType: EntityType.INVOICE,
    entityId: invoiceId,
    action: 'CORRECT',
    fromStatus: invoice.status,
    toStatus: invoice.status,
    beforeData,
    afterData: updatedInvoice,
    operator: options.operator || 'SYSTEM',
    reason: options.reason || 'Manual correction'
  });

  return updatedInvoice;
}

module.exports = {
  getInvoice,
  getInvoiceByNo,
  getInvoicesByDonation,
  getAllInvoices,
  applyForInvoice,
  issueInvoice,
  cancelInvoice,
  downloadInvoice,
  correctInvoice
};
