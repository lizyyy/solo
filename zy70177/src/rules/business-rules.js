const moment = require('moment');

const BUSINESS_RULES = {
  MILESTONE_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    INVOICED: 'invoiced',
    PAID: 'paid',
    OVERDUE: 'overdue'
  },

  ACCEPTANCE_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    REJECTED: 'rejected'
  },

  INVOICE_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    ISSUED: 'issued',
    PAID: 'paid',
    REJECTED: 'rejected'
  },

  PAYMENT_STATUS: {
    RECEIVED: 'received',
    ASSIGNED: 'assigned',
    PARTIAL: 'partial'
  },

  OVERDUE_LEVELS: {
    CRITICAL: 'critical',
    WARNING: 'warning',
    ATTENTION: 'attention'
  },

  canApplyForInvoice: (milestoneStatus, acceptanceStatus) => {
    return milestoneStatus === BUSINESS_RULES.MILESTONE_STATUS.ACCEPTED || 
           (milestoneStatus === BUSINESS_RULES.MILESTONE_STATUS.PENDING && 
            acceptanceStatus === BUSINESS_RULES.ACCEPTANCE_STATUS.CONFIRMED);
  },

  canAssignPayment: (invoiceStatus) => {
    return invoiceStatus === BUSINESS_RULES.INVOICE_STATUS.ISSUED;
  },

  isMilestoneOverdue: (dueDate, currentDate = new Date()) => {
    return moment(dueDate).isBefore(moment(currentDate).startOf('day'));
  },

  getOverdueDays: (dueDate, currentDate = new Date()) => {
    const diff = moment(currentDate).startOf('day').diff(moment(dueDate).startOf('day'), 'days');
    return diff > 0 ? diff : 0;
  },

  calculatePaymentProgress: (milestoneAmount, collectedAmount) => {
    if (!milestoneAmount || milestoneAmount === 0) return 0;
    return Math.min(100, (collectedAmount / milestoneAmount) * 100);
  },

  validateInvoiceAmount: (invoiceAmount, milestoneAmount) => {
    if (!invoiceAmount || invoiceAmount <= 0) {
      return { valid: false, message: '开票金额必须大于0' };
    }
    if (invoiceAmount > milestoneAmount) {
      return { valid: false, message: '开票金额不能超过里程碑金额' };
    }
    return { valid: true, message: '验证通过' };
  },

  validatePaymentAssignment: (paymentAmount, remainingAmount) => {
    if (!paymentAmount || paymentAmount <= 0) {
      return { valid: false, message: '回款金额必须大于0' };
    }
    if (paymentAmount > remainingAmount) {
      return { valid: false, message: '回款金额不能超过剩余应回款金额' };
    }
    return { valid: true, message: '验证通过' };
  }
};

module.exports = BUSINESS_RULES;
