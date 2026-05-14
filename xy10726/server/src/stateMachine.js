const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = [
  'pending',
  'uploaded',
  'ocr_processing',
  'ocr_failed',
  'ocr_success',
  'tax_validating',
  'tax_invalid',
  'duplicate_checking',
  'duplicate_found',
  'review_pending',
  'review_approved',
  'review_rejected',
  'export_ready',
  'exported'
];

const TRANSITIONS = {
  pending: ['uploaded'],
  uploaded: ['ocr_processing'],
  ocr_processing: ['ocr_success', 'ocr_failed'],
  ocr_failed: ['ocr_processing', 'review_pending'],
  ocr_success: ['tax_validating'],
  tax_validating: ['tax_invalid', 'duplicate_checking'],
  tax_invalid: ['review_pending'],
  duplicate_checking: ['duplicate_found', 'review_pending'],
  duplicate_found: ['review_pending'],
  review_pending: ['review_approved', 'review_rejected'],
  review_approved: ['export_ready'],
  review_rejected: ['ocr_processing'],
  export_ready: ['exported'],
  exported: []
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) || false;
}

async function transition(invoiceId, newStatus, operator = 'system', reason = '', fieldsChanged = null) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('发票不存在');
  
  if (!canTransition(invoice.status, newStatus)) {
    throw new Error(`不允许从 ${invoice.status} 转换到 ${newStatus}`);
  }

  const oldStatus = invoice.status;
  
  await db.run(
    'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, invoiceId]
  );

  await db.run(
    'INSERT INTO audit_logs (invoice_id, action, status_from, status_to, operator, reason, fields_changed) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [invoiceId, 'status_change', oldStatus, newStatus, operator, reason, fieldsChanged ? JSON.stringify(fieldsChanged) : null]
  );

  return { success: true, oldStatus, newStatus };
}

function validateTaxNumber(taxNumber) {
  if (!taxNumber || taxNumber.length !== 15 && taxNumber.length !== 18) {
    return { valid: false, reason: '税号长度必须为15或18位' };
  }
  
  const regex = /^[A-Z0-9]+$/;
  if (!regex.test(taxNumber)) {
    return { valid: false, reason: '税号格式不正确' };
  }
  
  return { valid: true };
}

async function checkDuplicate(invoice) {
  if (!invoice.invoice_number || !invoice.invoice_code) {
    return { isDuplicate: false };
  }

  const duplicates = await db.all(
    `SELECT id FROM invoices 
     WHERE invoice_number = ? AND invoice_code = ? AND id != ? AND status NOT IN ('review_rejected')`,
    [invoice.invoice_number, invoice.invoice_code, invoice.id]
  );

  if (duplicates.length > 0) {
    return {
      isDuplicate: true,
      duplicateWith: duplicates[0].id,
      reason: `发票代码 ${invoice.invoice_code} 号码 ${invoice.invoice_number} 已存在`
    };
  }

  return { isDuplicate: false };
}

async function recordDuplicate(invoiceId, duplicateWith, reason) {
  await db.run(
    'INSERT INTO duplicates (invoice_id, duplicate_with, reason) VALUES (?, ?, ?)',
    [invoiceId, duplicateWith, reason]
  );
}

module.exports = {
  VALID_STATUSES,
  canTransition,
  transition,
  validateTaxNumber,
  checkDuplicate,
  recordDuplicate
};
