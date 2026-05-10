const { runAsync, getAsync, allAsync } = require('../database/database');
const BUSINESS_RULES = require('../rules/business-rules');
const invoiceService = require('./invoice-service');
const milestoneService = require('./milestone-service');
const { auditService, TABLE_NAMES } = require('./audit-service');

const paymentService = {
  recordPayment: async (data) => {
    const result = await runAsync(
      `INSERT INTO payments (project_id, amount, payment_date, bank_reference, payer, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
      [data.project_id, data.amount, data.payment_date, data.bank_reference || null, data.payer || null, data.remarks || null]
    );
    
    const createdPayment = await getAsync('SELECT * FROM payments WHERE id = ?', [result.lastID]);
    await auditService.logCreate(TABLE_NAMES.PAYMENTS, result.lastID, data.user_id || 'system', createdPayment);
    
    return createdPayment;
  },

  assignPaymentToInvoice: async (paymentId, invoiceId, amount, assignedBy) => {
    const payment = await getAsync('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) {
      throw new Error('回款记录不存在');
    }

    const invoice = await invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('发票不存在');
    }

    if (!BUSINESS_RULES.canAssignPayment(invoice.status)) {
      throw new Error('发票状态不允许进行回款认领');
    }

    const paymentSummary = await invoiceService.getInvoicePaymentSummary(invoiceId);
    const validation = BUSINESS_RULES.validatePaymentAssignment(
      amount,
      paymentSummary.remaining
    );
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const result = await runAsync(
      `INSERT INTO payment_assignments (payment_id, invoice_id, amount, assigned_by) VALUES (?, ?, ?, ?)`,
      [paymentId, invoiceId, amount, assignedBy]
    );

    await milestoneService.addCollectedAmount(invoice.milestone_id, amount);

    const updatedSummary = await invoiceService.getInvoicePaymentSummary(invoiceId);
    if (updatedSummary.remaining <= 0) {
      await runAsync(
        `UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [BUSINESS_RULES.INVOICE_STATUS.PAID, invoiceId]
      );

      await milestoneService.updateInvoiceStatus(
        invoice.milestone_id,
        BUSINESS_RULES.INVOICE_STATUS.PAID
      );
    }

    const assignment = await getAsync('SELECT * FROM payment_assignments WHERE id = ?', [result.lastID]);
    await auditService.logAssign(TABLE_NAMES.PAYMENT_ASSIGNMENTS, result.lastID, assignedBy, assignment);
    
    return assignment;
  },

  getPaymentById: async (id) => {
    return await getAsync('SELECT * FROM payments WHERE id = ?', [id]);
  },

  getPaymentsByProject: async (projectId) => {
    return await allAsync(
      `SELECT * FROM payments WHERE project_id = ? ORDER BY payment_date DESC`,
      [projectId]
    );
  },

  getAllPayments: async () => {
    return await allAsync('SELECT * FROM payments ORDER BY created_at DESC');
  },

  getPaymentWithAssignments: async (paymentId) => {
    const payment = await getAsync('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) return null;

    const assignments = await allAsync(
      `SELECT pa.*, i.invoice_no, i.amount as invoice_amount
       FROM payment_assignments pa
       JOIN invoices i ON pa.invoice_id = i.id
       WHERE pa.payment_id = ?
       ORDER BY pa.created_at DESC`,
      [paymentId]
    );

    const totalAssigned = assignments.reduce((sum, a) => sum + a.amount, 0);

    return {
      payment,
      assignments,
      totalAssigned,
      remaining: payment.amount - totalAssigned
    };
  },

  getUnassignedInvoices: async () => {
    return await allAsync(`
      SELECT i.*, m.name as milestone_name, p.name as project_name
      FROM invoices i
      JOIN milestones m ON i.milestone_id = m.id
      JOIN projects p ON m.project_id = p.id
      WHERE i.status = 'issued'
      AND i.id NOT IN (
        SELECT DISTINCT invoice_id FROM payment_assignments
      )
      ORDER BY i.created_at DESC
    `);
  },

  getPaymentAssignmentSummary: async (projectId = null) => {
    const params = projectId ? [projectId] : [];
    const whereClause = projectId ? 'WHERE p.project_id = ?' : '';
    
    const payments = await allAsync(`
      SELECT p.*, 
             (SELECT SUM(amount) FROM payment_assignments pa WHERE pa.payment_id = p.id) as assigned_amount
      FROM payments p
      ${whereClause}
      ORDER BY p.payment_date DESC
    `, ...params);

    return payments.map(p => ({
      ...p,
      assigned_amount: p.assigned_amount || 0,
      remaining: p.amount - (p.assigned_amount || 0),
      status: (p.assigned_amount || 0) >= p.amount ? 'assigned' : 'partial'
    }));
  }
};

module.exports = paymentService;
