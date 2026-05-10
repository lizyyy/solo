const { runAsync, getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');
const milestoneService = require('./milestone-service');
const { auditService, TABLE_NAMES } = require('./audit-service');

const invoiceService = {
  createInvoice: async (data) => {
    const milestone = await milestoneService.getMilestoneById(data.milestone_id);
    if (!milestone) {
      throw new Error('里程碑不存在');
    }

    const canApply = BUSINESS_RULES.canApplyForInvoice(
      milestone.status,
      milestone.acceptance_status
    );
    if (!canApply) {
      throw new Error('里程碑未验收通过，无法申请开票');
    }

    const validation = BUSINESS_RULES.validateInvoiceAmount(
      data.amount,
      milestone.amount
    );
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const result = await runAsync(
      `INSERT INTO invoices (milestone_id, invoice_no, amount, remarks) VALUES (?, ?, ?, ?)`,
      [data.milestone_id, data.invoice_no, data.amount, data.remarks || null]
    );

    await milestoneService.updateInvoiceStatus(
      data.milestone_id,
      BUSINESS_RULES.INVOICE_STATUS.PENDING
    );

    const createdInvoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [result.lastID]);
    await auditService.logCreate(TABLE_NAMES.INVOICES, result.lastID, data.user_id || 'system', createdInvoice);

    return createdInvoice;
  },

  approveInvoice: async (invoiceId, data) => {
    const invoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) {
      throw new Error('开票申请不存在');
    }

    if (invoice.status !== BUSINESS_RULES.INVOICE_STATUS.PENDING) {
      throw new Error('开票申请已处理，无法重复审批');
    }

    await runAsync(
      `UPDATE invoices SET status = ?, approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [BUSINESS_RULES.INVOICE_STATUS.APPROVED, data.approved_by, invoiceId]
    );

    await milestoneService.updateInvoiceStatus(
      invoice.milestone_id,
      BUSINESS_RULES.INVOICE_STATUS.APPROVED
    );

    const updatedInvoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    await auditService.logApprove(TABLE_NAMES.INVOICES, invoiceId, data.approved_by, updatedInvoice);

    return updatedInvoice;
  },

  issueInvoice: async (invoiceId, data) => {
    const invoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) {
      throw new Error('开票申请不存在');
    }

    if (invoice.status !== BUSINESS_RULES.INVOICE_STATUS.APPROVED) {
      throw new Error('开票申请未通过审批，无法开具发票');
    }

    await runAsync(
      `UPDATE invoices SET status = ?, issued_by = ?, issued_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [BUSINESS_RULES.INVOICE_STATUS.ISSUED, data.issued_by, data.issued_date || new Date().toISOString().split('T')[0], invoiceId]
    );

    await milestoneService.updateInvoiceStatus(
      invoice.milestone_id,
      BUSINESS_RULES.INVOICE_STATUS.ISSUED
    );

    await milestoneService.updateMilestoneStatus(
      invoice.milestone_id,
      BUSINESS_RULES.MILESTONE_STATUS.INVOICED
    );

    const updatedInvoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    await auditService.logIssue(TABLE_NAMES.INVOICES, invoiceId, data.issued_by, updatedInvoice);

    return updatedInvoice;
  },

  rejectInvoice: async (invoiceId, data) => {
    const invoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) {
      throw new Error('开票申请不存在');
    }

    if (invoice.status !== BUSINESS_RULES.INVOICE_STATUS.PENDING) {
      throw new Error('开票申请已处理，无法拒绝');
    }

    await runAsync(
      `UPDATE invoices SET status = ?, remarks = ?, updated_at = datetime('now') WHERE id = ?`,
      [BUSINESS_RULES.INVOICE_STATUS.REJECTED, data.remarks || invoice.remarks, invoiceId]
    );

    await milestoneService.updateInvoiceStatus(
      invoice.milestone_id,
      BUSINESS_RULES.INVOICE_STATUS.REJECTED
    );

    await auditService.logReject(TABLE_NAMES.INVOICES, invoiceId, data.approved_by || 'system', data.remarks);

    return await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  },

  getInvoiceById: async (id) => {
    return await getAsync('SELECT * FROM invoices WHERE id = ?', [id]);
  },

  getInvoicesByMilestone: async (milestoneId) => {
    return await allAsync(
      `SELECT * FROM invoices WHERE milestone_id = ? ORDER BY created_at DESC`,
      [milestoneId]
    );
  },

  getAllInvoices: async () => {
    return await allAsync('SELECT * FROM invoices ORDER BY created_at DESC');
  },

  getInvoicePaymentSummary: async (invoiceId) => {
    const invoice = await getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) return null;

    const assignments = await allAsync(
      `SELECT * FROM payment_assignments WHERE invoice_id = ?`,
      [invoiceId]
    );

    const totalAssigned = assignments.reduce((sum, a) => sum + a.amount, 0);
    const remaining = invoice.amount - totalAssigned;

    return {
      invoice,
      assignments,
      totalAssigned,
      remaining,
      progress: BUSINESS_RULES.calculatePaymentProgress(invoice.amount, totalAssigned)
    };
  }
};

module.exports = invoiceService;
