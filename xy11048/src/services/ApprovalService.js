const { APPROVAL_STATES, APPROVAL_TRANSITIONS, HAZARDOUS_QUOTA, REAGENT_CATEGORIES, APPROVAL_ROLES } = require('../config/constants');
const { ApprovalError, ErrorCodes } = require('../utils/errors');
const store = require('../data/store');
const ApprovalRequest = require('../models/ApprovalRequest');

class ApprovalService {
  constructor() {
    this.processingRequests = new Set();
  }

  generateRequestNo() {
    const date = new Date();
    const prefix = `RL${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = store.getAllApprovalRequests().filter(r => r.requestNo.startsWith(prefix)).length;
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  createRequest(data) {
    const validation = ApprovalRequest.validate(data);
    if (!validation.valid) {
      throw new ApprovalError('数据验证失败', ErrorCodes.VALIDATION_ERROR, { errors: validation.errors });
    }

    const request = new ApprovalRequest({
      ...data,
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestNo: this.generateRequestNo(),
      currentState: APPROVAL_STATES.DRAFT
    });
    
    request.calculateTotalAmount();
    return store.addApprovalRequest(request);
  }

  submitRequest(requestId, etag) {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    if (request.etag !== etag) {
      throw new ApprovalError('数据已被修改', ErrorCodes.ETAG_MISMATCH, { requestId });
    }

    if (this.processingRequests.has(requestId)) {
      throw new ApprovalError('申请正在处理中，请勿重复提交', ErrorCodes.DUPLICATE_SUBMISSION, { requestId });
    }

    this.processingRequests.add(requestId);

    try {
      this.validateStateTransition(request.currentState, APPROVAL_STATES.SUBMITTED);
      
      const hazardousCheck = this.checkHazardousQuota(request);
      if (hazardousCheck.requiresSecondReview) {
        request.secondReviewRequired = true;
        request.pendingReviewReasons = hazardousCheck.reasons;
      }

      request.currentState = APPROVAL_STATES.SUBMITTED;
      request.submittedAt = new Date();
      request.addApprovalRecord(request.applicantId, request.applicantName, APPROVAL_ROLES.APPLICANT, 'submit', '提交申请');
      
      store.updateApprovalRequest(requestId, request);
      return request;
    } finally {
      this.processingRequests.delete(requestId);
    }
  }

  labManagerApprove(requestId, approverId, approverName, comments = '') {
    return this.transitionState(
      requestId,
      APPROVAL_STATES.SUBMITTED,
      APPROVAL_STATES.LAB_MANAGER_APPROVED,
      approverId,
      approverName,
      APPROVAL_ROLES.LAB_MANAGER,
      comments
    );
  }

  safetyOfficerReview(requestId, approverId, approverName, comments = '') {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    if (request.secondReviewRequired && !request.secondReviewCompleted) {
      request.pendingReviewReasons.push('危化试剂超量，需要高级安全管理员二次审批');
      return this.transitionToPendingReview(
        requestId,
        approverId,
        approverName,
        comments,
        request.pendingReviewReasons
      );
    }

    return this.transitionState(
      requestId,
      APPROVAL_STATES.LAB_MANAGER_APPROVED,
      APPROVAL_STATES.SAFETY_REVIEWED,
      approverId,
      approverName,
      APPROVAL_ROLES.SAFETY_OFFICER,
      comments
    );
  }

  secondReviewApprove(requestId, approverId, approverName, comments = '') {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    if (!request.secondReviewRequired) {
      throw new ApprovalError('该申请不需要二次审批', ErrorCodes.INVALID_STATE_TRANSITION, { 
        currentState: request.currentState,
        secondReviewRequired: request.secondReviewRequired
      });
    }

    request.secondReviewCompleted = true;
    request.pendingReviewReasons = [];
    
    return this.transitionState(
      requestId,
      APPROVAL_STATES.PENDING_SECOND_REVIEW,
      APPROVAL_STATES.APPROVED,
      approverId,
      approverName,
      APPROVAL_ROLES.ADMIN,
      comments
    );
  }

  auditCheck(requestId, auditorId, auditorName, actualInventory) {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    if (request.currentState !== APPROVAL_STATES.SAFETY_REVIEWED) {
      throw new ApprovalError('只有已通过安全审核的申请才能进行审计检查', ErrorCodes.INVALID_STATE_TRANSITION, {
        currentState: request.currentState,
        expected: APPROVAL_STATES.SAFETY_REVIEWED
      });
    }

    const auditResult = this.checkAuditConsistency(request, actualInventory);
    
    if (!auditResult.consistent) {
      request.auditNotes = auditResult.issues;
      request.currentState = APPROVAL_STATES.AUDIT_INCONSISTENCY;
      request.addApprovalRecord(auditorId, auditorName, APPROVAL_ROLES.AUDITOR, 'audit_fail', JSON.stringify(auditResult.issues));
      store.updateApprovalRequest(requestId, request);
      
      throw new ApprovalError('审计一致性检查未通过', ErrorCodes.AUDIT_INCONSISTENCY, {
        issues: auditResult.issues,
        requestId,
        resolution: '请核对领用记录与实际库存差异，修正后可重新提交审核'
      });
    }

    return this.transitionState(
      requestId,
      APPROVAL_STATES.SAFETY_REVIEWED,
      APPROVAL_STATES.APPROVED,
      auditorId,
      auditorName,
      APPROVAL_ROLES.AUDITOR,
      '审计通过'
    );
  }

  reject(requestId, approverId, approverName, role, reason) {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    const validRejectStates = [
      APPROVAL_STATES.SUBMITTED,
      APPROVAL_STATES.LAB_MANAGER_APPROVED,
      APPROVAL_STATES.SAFETY_REVIEWED,
      APPROVAL_STATES.PENDING_SECOND_REVIEW,
      APPROVAL_STATES.AUDIT_INCONSISTENCY
    ];

    if (!validRejectStates.includes(request.currentState)) {
      throw new ApprovalError('当前状态不允许驳回', ErrorCodes.INVALID_STATE_TRANSITION, {
        currentState: request.currentState
      });
    }

    request.currentState = APPROVAL_STATES.REJECTED;
    request.rejectionReason = reason;
    request.addApprovalRecord(approverId, approverName, role, 'reject', reason);
    store.updateApprovalRequest(requestId, request);
    return request;
  }

  transitionState(requestId, fromState, toState, approverId, approverName, role, comments) {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    if (request.currentState !== fromState) {
      throw new ApprovalError('状态不匹配', ErrorCodes.INVALID_STATE_TRANSITION, {
        currentState: request.currentState,
        expected: fromState,
        requested: toState
      });
    }

    this.validateStateTransition(request.currentState, toState);

    request.currentState = toState;
    request.addApprovalRecord(approverId, approverName, role, toState, comments);
    
    if (toState === APPROVAL_STATES.APPROVED) {
      request.approvedAt = new Date();
    }
    
    store.updateApprovalRequest(requestId, request);
    return request;
  }

  transitionToPendingReview(requestId, approverId, approverName, comments, reasons) {
    const request = store.getApprovalRequest(requestId);
    if (!request) {
      throw new ApprovalError('申请不存在', ErrorCodes.NOT_FOUND, { requestId });
    }

    request.currentState = APPROVAL_STATES.PENDING_SECOND_REVIEW;
    request.pendingReviewReasons = reasons;
    request.addApprovalRecord(approverId, approverName, APPROVAL_ROLES.SAFETY_OFFICER, 'pending_second_review', comments);
    store.updateApprovalRequest(requestId, request);
    return request;
  }

  validateStateTransition(currentState, nextState) {
    const allowedTransitions = APPROVAL_TRANSITIONS[currentState];
    if (!allowedTransitions || !allowedTransitions.includes(nextState)) {
      throw new ApprovalError(`不允许从 ${currentState} 转换到 ${nextState}`, ErrorCodes.INVALID_STATE_TRANSITION, {
        currentState,
        requestedState: nextState,
        allowedTransitions: allowedTransitions || []
      });
    }

    const stateOrder = [
      APPROVAL_STATES.DRAFT,
      APPROVAL_STATES.SUBMITTED,
      APPROVAL_STATES.LAB_MANAGER_APPROVED,
      APPROVAL_STATES.SAFETY_REVIEWED,
      APPROVAL_STATES.APPROVED
    ];

    const currentIndex = stateOrder.indexOf(currentState);
    const nextIndex = stateOrder.indexOf(nextState);
    
    if (nextIndex !== -1 && currentIndex !== -1 && nextIndex > currentIndex + 1) {
      throw new ApprovalError('不允许跳级审批', ErrorCodes.STATE_TRANSITION_SKIPPED, {
        currentState,
        requestedState: nextState,
        skippedStates: stateOrder.slice(currentIndex + 1, nextIndex)
      });
    }
  }

  checkHazardousQuota(request) {
    const hazardousItems = request.getHazardousItems();
    const reasons = [];
    let requiresSecondReview = false;

    hazardousItems.forEach(item => {
      const quota = HAZARDOUS_QUOTA[item.hazardLevel];
      if (!quota) return;

      const monthlyUsage = store.getMonthlyUsage(
        request.applicantId,
        item.reagentId,
        new Date()
      );

      if (item.quantity > quota.singleLimit) {
        reasons.push(`试剂 ${item.reagentName} 单次领用限额 ${quota.singleLimit}${item.unit}，当前申请 ${item.quantity}${item.unit} 超出限额`);
      }

      if (monthlyUsage + item.quantity > quota.monthlyLimit) {
        reasons.push(`试剂 ${item.reagentName} 月度领用限额 ${quota.monthlyLimit}${item.unit}，本月已领用 ${monthlyUsage}${item.unit}，申请 ${item.quantity}${item.unit} 将超出限额`);
      }

      if (quota.requiresSecondReview) {
        requiresSecondReview = true;
        reasons.push(`试剂 ${item.reagentName} 危险等级为 ${item.hazardLevel}，需要二次审批`);
      }
    });

    return { requiresSecondReview, reasons, passed: reasons.length === 0 };
  }

  checkAuditConsistency(request, actualInventory) {
    const issues = [];

    request.items.forEach(item => {
      const reagent = store.getReagent(item.reagentId);
      if (!reagent) {
        issues.push(`试剂 ${item.reagentName} 不存在于库存系统中`);
        return;
      }

      const actualStock = actualInventory[item.reagentId] ?? reagent.currentStock;
      
      if (item.quantity > actualStock) {
        issues.push(`试剂 ${item.reagentName} 实际库存 ${actualStock}${item.unit}，申请数量 ${item.quantity}${item.unit} 超出库存`);
      }

      if (actualStock !== reagent.currentStock) {
        issues.push(`试剂 ${item.reagentName} 系统记录库存 ${reagent.currentStock}${item.unit} 与实际库存 ${actualStock}${item.unit} 不一致，请核实`);
      }
    });

    const totalFromItems = request.items.reduce((sum, item) => sum + item.quantity, 0);
    if (Math.abs(totalFromItems - request.totalAmount) > 0.001) {
      issues.push(`申请总数量 ${request.totalAmount} 与明细合计 ${totalFromItems} 不一致`);
    }

    return { consistent: issues.length === 0, issues };
  }

  getRequest(requestId) {
    return store.getApprovalRequest(requestId);
  }

  getAllRequests(filters = {}) {
    let requests = store.getAllApprovalRequests();
    
    if (filters.state) {
      requests = requests.filter(r => r.currentState === filters.state);
    }
    if (filters.applicantId) {
      requests = requests.filter(r => r.applicantId === filters.applicantId);
    }
    if (filters.labId) {
      requests = requests.filter(r => r.labId === filters.labId);
    }
    
    return requests;
  }
}

module.exports = new ApprovalService();
