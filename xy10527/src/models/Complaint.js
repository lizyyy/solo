const { generateComplaintNo, generateId } = require('../utils/idGenerator');

const COMPLAINT_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  EVIDENCE_REVIEWING: 'EVIDENCE_REVIEWING',
  WAITING_LEADER_CONFIRM: 'WAITING_LEADER_CONFIRM',
  TRIAL_CALCULATION: 'TRIAL_CALCULATION',
  APPROVING: 'APPROVING',
  APPROVED: 'APPROVED',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXCEPTION: 'EXCEPTION'
};

const COMPLAINT_REJECT_REASONS = {
  EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
  NOT_SHORTAGE: 'NOT_SHORTAGE',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  LEADER_NOT_CONFIRMED: 'LEADER_NOT_CONFIRMED',
  DUPLICATE_COMPLAINT: 'DUPLICATE_COMPLAINT',
  OTHER: 'OTHER'
};

class Complaint {
  constructor({
    complaintNo = generateComplaintNo(),
    orderId,
    orderNo,
    userId,
    groupLeaderId,
    complaintItems = [],
    description,
    filedTime = new Date(),
    status = COMPLAINT_STATUS.PENDING_REVIEW,
    evidences = [],
    trialCalculation = null,
    approvals = [],
    payments = [],
    currentHandlerId = null,
    rejectReason = null,
    rejectNote = null,
    history = [],
    exceptionReason = null,
    isDuplicateOf = null
  }) {
    this.id = generateId();
    this.complaintNo = complaintNo;
    this.orderId = orderId;
    this.orderNo = orderNo;
    this.userId = userId;
    this.groupLeaderId = groupLeaderId;
    this.complaintItems = complaintItems.map(item => ({
      id: generateId(),
      itemId: item.itemId,
      productId: item.productId,
      productName: item.productName,
      claimedWeight: item.claimedWeight,
      claimedShortage: item.claimedShortage,
      unit: item.unit || 'kg'
    }));
    this.description = description;
    this.filedTime = filedTime;
    this.status = status;
    this.evidences = evidences.map(e => ({
      id: generateId(),
      type: e.type,
      url: e.url,
      uploadedAt: e.uploadedAt || new Date(),
      uploaderId: e.uploaderId,
      description: e.description
    }));
    this.trialCalculation = trialCalculation ? {
      id: generateId(),
      calculatedAt: trialCalculation.calculatedAt || new Date(),
      items: trialCalculation.items,
      totalShortageWeight: trialCalculation.totalShortageWeight,
      totalCompensationAmount: trialCalculation.totalCompensationAmount,
      compensationRules: trialCalculation.compensationRules,
      operatorId: trialCalculation.operatorId
    } : null;
    this.approvals = approvals.map(a => ({
      id: generateId(),
      approvalType: a.approvalType,
      operatorId: a.operatorId,
      operatorName: a.operatorName,
      decision: a.decision,
      comment: a.comment,
      approvedAt: a.approvedAt || new Date()
    }));
    this.payments = payments.map(p => ({
      id: generateId(),
      paymentNo: p.paymentNo,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      status: p.status,
      processedAt: p.processedAt || new Date(),
      callbackTime: p.callbackTime,
      callbackResult: p.callbackResult
    }));
    this.currentHandlerId = currentHandlerId;
    this.rejectReason = rejectReason;
    this.rejectNote = rejectNote;
    this.history = history.map(h => ({
      id: generateId(),
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      operatorId: h.operatorId,
      operatorName: h.operatorName,
      description: h.description,
      diffBefore: h.diffBefore,
      diffAfter: h.diffAfter,
      timestamp: h.timestamp || new Date(),
      ip: h.ip
    }));
    this.exceptionReason = exceptionReason;
    this.isDuplicateOf = isDuplicateOf;
    this.idempotencyKeys = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  changeStatus(newStatus, options = {}) {
    const oldStatus = this.status;
    const { operatorId, operatorName, description, diffBefore, diffAfter, ip } = options;
    
    this.status = newStatus;
    this.updatedAt = new Date();
    
    if (operatorId) {
      this.history.push({
        id: generateId(),
        action: 'STATUS_CHANGE',
        fromStatus: oldStatus,
        toStatus: newStatus,
        operatorId,
        operatorName,
        description,
        diffBefore,
        diffAfter,
        timestamp: new Date(),
        ip
      });
    }
  }

  addEvidence(evidence) {
    this.evidences.push({
      id: generateId(),
      type: evidence.type,
      url: evidence.url,
      uploadedAt: new Date(),
      uploaderId: evidence.uploaderId,
      description: evidence.description
    });
    this.updatedAt = new Date();
  }

  addApproval(approval) {
    this.approvals.push({
      id: generateId(),
      approvalType: approval.approvalType,
      operatorId: approval.operatorId,
      operatorName: approval.operatorName,
      decision: approval.decision,
      comment: approval.comment,
      approvedAt: new Date()
    });
    this.updatedAt = new Date();
  }

  addPayment(payment) {
    this.payments.push({
      id: generateId(),
      paymentNo: payment.paymentNo,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      processedAt: new Date(),
      callbackTime: payment.callbackTime,
      callbackResult: payment.callbackResult
    });
    this.updatedAt = new Date();
  }

  setTrialCalculation(calculation) {
    this.trialCalculation = {
      id: generateId(),
      calculatedAt: new Date(),
      items: calculation.items,
      totalShortageWeight: calculation.totalShortageWeight,
      totalCompensationAmount: calculation.totalCompensationAmount,
      compensationRules: calculation.compensationRules,
      operatorId: calculation.operatorId
    };
    this.updatedAt = new Date();
  }

  checkIdempotency(key) {
    return this.idempotencyKeys[key];
  }

  markIdempotency(key, result) {
    this.idempotencyKeys[key] = {
      result,
      timestamp: new Date()
    };
  }
}

module.exports = {
  Complaint,
  COMPLAINT_STATUS,
  COMPLAINT_REJECT_REASONS
};
