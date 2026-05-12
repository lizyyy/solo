const { Complaint, COMPLAINT_STATUS, COMPLAINT_REJECT_REASONS } = require('../models/Complaint');
const store = require('../data/memoryStore');
const logger = require('../utils/logger');
const { generateId } = require('../utils/idGenerator');
const orderService = require('./OrderService');
const { CompensationRuleEngine } = require('../rules/compensationRules');

const ruleEngine = new CompensationRuleEngine();

class ComplaintService {
  constructor() {
    this.globalIdempotencyKeys = {};
  }

  checkGlobalIdempotency(key) {
    return this.globalIdempotencyKeys[key];
  }

  markGlobalIdempotency(key, result) {
    this.globalIdempotencyKeys[key] = {
      result,
      timestamp: new Date()
    };
  }

  createComplaint(data, idempotencyKey = null) {
    if (idempotencyKey) {
      const existing = this.checkGlobalIdempotency(idempotencyKey);
      if (existing) {
        logger.info('幂等命中: 创建投诉', idempotencyKey);
        return existing.result;
      }
    }

    logger.info('创建投诉', data);
    
    const order = orderService.getOrder(data.orderId);
    if (!order) {
      throw new Error('订单不存在');
    }

    const complaint = new Complaint({
      orderId: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      groupLeaderId: order.groupLeaderId,
      complaintItems: data.complaintItems,
      description: data.description
    });

    if (data.evidences && data.evidences.length > 0) {
      data.evidences.forEach(e => complaint.addEvidence(e));
    }

    const existingComplaints = store.getComplaintsByOrderId(order.id);
    const duplicateCheck = ruleEngine.checkDuplicateComplaint(existingComplaints, complaint);
    
    if (duplicateCheck.isDuplicate) {
      complaint.status = COMPLAINT_STATUS.REJECTED;
      complaint.rejectReason = COMPLAINT_REJECT_REASONS.DUPLICATE_COMPLAINT;
      complaint.isDuplicateOf = duplicateCheck.existingComplaintId;
      complaint.rejectNote = `重复投诉，关联投诉单号: ${duplicateCheck.existingComplaintNo}`;
    }

    const timeCheck = ruleEngine.checkTimeLimit(order.deliveryTime, complaint.filedTime);
    if (!timeCheck.withinLimit) {
      complaint.status = COMPLAINT_STATUS.REJECTED;
      complaint.rejectReason = COMPLAINT_REJECT_REASONS.TIME_LIMIT_EXCEEDED;
      complaint.rejectNote = `超过投诉时限，超出 ${timeCheck.exceededBy.toFixed(2)} 小时`;
    }

    if (!order.leaderConfirmed && complaint.status !== COMPLAINT_STATUS.REJECTED) {
      complaint.status = COMPLAINT_STATUS.WAITING_LEADER_CONFIRM;
    }

    store.saveComplaint(complaint);

    store.recordOperation({
      type: 'COMPLAINT_CREATE',
      complaintId: complaint.id,
      complaintNo: complaint.complaintNo,
      orderId: order.id,
      data: {
        itemCount: complaint.complaintItems.length,
        initialStatus: complaint.status,
        isDuplicate: duplicateCheck.isDuplicate,
        withinTimeLimit: timeCheck.withinLimit
      }
    });

    if (idempotencyKey) {
      this.markGlobalIdempotency(idempotencyKey, complaint);
    }

    return complaint;
  }

  addEvidence(complaintId, evidence, operatorId, operatorName, idempotencyKey = null) {
    if (idempotencyKey) {
      const complaint = store.getComplaintById(complaintId);
      if (complaint) {
        const existing = complaint.checkIdempotency(idempotencyKey);
        if (existing) {
          logger.info('幂等命中: 添加证据', idempotencyKey);
          return existing.result;
        }
      }
    }

    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    if (complaint.status === COMPLAINT_STATUS.REJECTED || 
        complaint.status === COMPLAINT_STATUS.COMPLETED ||
        complaint.status === COMPLAINT_STATUS.CANCELLED) {
      throw new Error(`当前状态 ${complaint.status} 不允许添加证据`);
    }

    const beforeStatus = complaint.status;
    complaint.addEvidence(evidence);

    if (complaint.status === COMPLAINT_STATUS.PENDING_REVIEW) {
      complaint.changeStatus(COMPLAINT_STATUS.EVIDENCE_REVIEWING, {
        operatorId,
        operatorName,
        description: '提交证据，进入证据审核阶段'
      });
    }

    store.saveComplaint(complaint);

    const result = {
      success: true,
      evidenceCount: complaint.evidences.length,
      status: complaint.status
    };

    if (idempotencyKey) {
      complaint.markIdempotency(idempotencyKey, result);
      store.saveComplaint(complaint);
    }

    store.recordOperation({
      type: 'EVIDENCE_ADD',
      complaintId: complaint.id,
      operatorId,
      operatorName,
      data: {
        evidenceType: evidence.type,
        beforeStatus,
        afterStatus: complaint.status
      }
    });

    return result;
  }

  submitForLeaderConfirm(complaintId, operatorId, operatorName) {
    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    const validStatuses = [COMPLAINT_STATUS.PENDING_REVIEW, COMPLAINT_STATUS.EVIDENCE_REVIEWING];
    if (!validStatuses.includes(complaint.status)) {
      throw new Error(`当前状态 ${complaint.status} 不允许提交团长确认`);
    }

    const order = orderService.getOrder(complaint.orderId);
    if (order.leaderConfirmed) {
      return {
        success: true,
        message: '团长已确认过订单',
        leaderConfirmed: true
      };
    }

    complaint.changeStatus(COMPLAINT_STATUS.WAITING_LEADER_CONFIRM, {
      operatorId,
      operatorName,
      description: '等待团长确认订单和称重'
    });

    store.saveComplaint(complaint);

    store.recordOperation({
      type: 'LEADER_CONFIRM_REQUEST',
      complaintId: complaint.id,
      operatorId,
      operatorName
    });

    return {
      success: true,
      status: complaint.status,
      leaderConfirmed: false
    };
  }

  leaderConfirm(complaintId, confirmData, operatorId, operatorName) {
    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    const validStatuses = [
      COMPLAINT_STATUS.WAITING_LEADER_CONFIRM,
      COMPLAINT_STATUS.PENDING_REVIEW,
      COMPLAINT_STATUS.EVIDENCE_REVIEWING
    ];
    if (!validStatuses.includes(complaint.status)) {
      throw new Error(`当前状态 ${complaint.status} 不允许团长确认`);
    }

    const order = orderService.getOrder(complaint.orderId);
    
    if (confirmData.weightConfirmations) {
      confirmData.weightConfirmations.forEach(wc => {
        orderService.addWeightConfirmation(
          order.id,
          wc.itemId,
          wc.actualWeight,
          wc.photoUrl,
          operatorId,
          operatorName
        );
      });
    }

    if (confirmData.leaderConfirm !== false) {
      orderService.leaderConfirm(order.id, operatorId, operatorName);
    }

    const updatedOrder = orderService.getOrder(order.id);
    
    if (!updatedOrder.leaderConfirmed) {
      complaint.status = COMPLAINT_STATUS.REJECTED;
      complaint.rejectReason = COMPLAINT_REJECT_REASONS.LEADER_NOT_CONFIRMED;
      complaint.rejectNote = '团长拒绝确认订单，投诉驳回';
      complaint.changeStatus(COMPLAINT_STATUS.REJECTED, {
        operatorId,
        operatorName,
        description: '团长拒认，投诉驳回'
      });
    } else {
      complaint.changeStatus(COMPLAINT_STATUS.TRIAL_CALCULATION, {
        operatorId,
        operatorName,
        description: '团长确认完成，进入赔付试算阶段'
      });
    }

    store.saveComplaint(complaint);

    store.recordOperation({
      type: 'LEADER_CONFIRMED',
      complaintId: complaint.id,
      operatorId,
      operatorName,
      data: {
        leaderConfirmed: updatedOrder.leaderConfirmed,
        newStatus: complaint.status
      }
    });

    return {
      success: true,
      status: complaint.status,
      leaderConfirmed: updatedOrder.leaderConfirmed
    };
  }

  trialCalculate(complaintId, operatorId, operatorName, idempotencyKey = null) {
    if (idempotencyKey) {
      const complaint = store.getComplaintById(complaintId);
      if (complaint) {
        const existing = complaint.checkIdempotency(idempotencyKey);
        if (existing) {
          logger.info('幂等命中: 试算', idempotencyKey);
          return existing.result;
        }
      }
    }

    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    const validStatuses = [
      COMPLAINT_STATUS.PENDING_REVIEW,
      COMPLAINT_STATUS.EVIDENCE_REVIEWING,
      COMPLAINT_STATUS.TRIAL_CALCULATION,
      COMPLAINT_STATUS.WAITING_LEADER_CONFIRM
    ];
    if (!validStatuses.includes(complaint.status) && !complaint.trialCalculation) {
      throw new Error(`当前状态 ${complaint.status} 不允许试算`);
    }

    const order = orderService.getOrder(complaint.orderId);
    const weightChain = orderService.getOrderWeightChain(order.id);

    const eligibleItems = [];
    const ineligibleItems = [];
    const itemsToReject = [];

    for (const complaintItem of complaint.complaintItems) {
      const orderItem = order.items.find(i => i.productId === complaintItem.productId);
      const chainItem = weightChain.items.find(i => i.productId === complaintItem.productId);
      
      if (!orderItem || !chainItem) {
        itemsToReject.push({
          productId: complaintItem.productId,
          productName: complaintItem.productName,
          reason: '商品信息不匹配'
        });
        continue;
      }

      if (chainItem.actualWeight === null) {
        itemsToReject.push({
          productId: complaintItem.productId,
          productName: complaintItem.productName,
          reason: '缺少称重数据'
        });
        continue;
      }

      const toleranceCheck = ruleEngine.checkWeightTolerance(
        orderItem.expectedWeight,
        chainItem.actualWeight
      );

      if (toleranceCheck.isWithinTolerance) {
        ineligibleItems.push({
          productId: complaintItem.productId,
          productName: complaintItem.productName,
          expectedWeight: orderItem.expectedWeight,
          actualWeight: chainItem.actualWeight,
          diff: toleranceCheck.diff,
          reason: '在称重误差容忍范围内',
          toleranceDetail: toleranceCheck
        });
        continue;
      }

      eligibleItems.push({
        itemId: orderItem.id,
        productId: orderItem.productId,
        productName: orderItem.productName,
        expectedWeight: orderItem.expectedWeight,
        actualWeight: chainItem.actualWeight,
        shortageWeight: toleranceCheck.shortageAmount,
        unitPrice: orderItem.unitPrice,
        unit: orderItem.unit
      });
    }

    const partialCheck = ruleEngine.checkPartialShortage(
      eligibleItems.map(item => ({
        ...item,
        shortageWeight: item.shortageWeight
      }))
    );

    const compensationResult = partialCheck.eligible 
      ? ruleEngine.calculateBatchCompensation(partialCheck.items)
      : { items: [], totalShortageWeight: 0, totalFinalCompensation: 0 };

    const trialCalculation = {
      items: compensationResult.items.map(item => ({
        ...item,
        productId: item.productId || eligibleItems.find(e => e.itemId === item.itemId)?.productId,
        productName: item.productName || eligibleItems.find(e => e.itemId === item.itemId)?.productName
      })),
      totalShortageWeight: compensationResult.totalShortageWeight,
      totalCompensationAmount: compensationResult.totalFinalCompensation,
      compensationRules: {
        tolerance: ruleEngine.config.weightTolerance,
        ratio: ruleEngine.config.compensationRatio,
        partial: ruleEngine.config.partialCompensation
      },
      ineligibleItems,
      rejectedItems: itemsToReject,
      operatorId
    };

    if (trialCalculation.items.length === 0) {
      complaint.status = COMPLAINT_STATUS.REJECTED;
      complaint.rejectReason = COMPLAINT_REJECT_REASONS.NOT_SHORTAGE;
      complaint.rejectNote = '所有商品均不存在有效缺斤情况';
      complaint.changeStatus(COMPLAINT_STATUS.REJECTED, {
        operatorId,
        operatorName,
        description: '试算结果显示无有效缺斤，投诉驳回',
        diffBefore: { status: complaint.status },
        diffAfter: { status: COMPLAINT_STATUS.REJECTED }
      });
    } else {
      complaint.setTrialCalculation(trialCalculation);
      const readyStatuses = [
        COMPLAINT_STATUS.PENDING_REVIEW,
        COMPLAINT_STATUS.EVIDENCE_REVIEWING,
        COMPLAINT_STATUS.TRIAL_CALCULATION
      ];
      if (readyStatuses.includes(complaint.status)) {
        complaint.changeStatus(COMPLAINT_STATUS.APPROVING, {
          operatorId,
          operatorName,
          description: '试算完成，进入审批阶段'
        });
      }
    }

    store.saveComplaint(complaint);

    const result = {
      success: true,
      hasEligibleItems: trialCalculation.items.length > 0,
      trialCalculation,
      status: complaint.status
    };

    if (idempotencyKey) {
      complaint.markIdempotency(idempotencyKey, result);
      store.saveComplaint(complaint);
    }

    store.recordOperation({
      type: 'TRIAL_CALCULATION',
      complaintId: complaint.id,
      operatorId,
      operatorName,
      data: {
        eligibleCount: trialCalculation.items.length,
        totalShortage: trialCalculation.totalShortageWeight,
        totalCompensation: trialCalculation.totalCompensationAmount
      }
    });

    return result;
  }

  approve(complaintId, decision, comment, operatorId, operatorName, idempotencyKey = null) {
    if (idempotencyKey) {
      const complaint = store.getComplaintById(complaintId);
      if (complaint) {
        const existing = complaint.checkIdempotency(idempotencyKey);
        if (existing) {
          logger.info('幂等命中: 审批', idempotencyKey);
          return existing.result;
        }
      }
    }

    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    if (complaint.status !== COMPLAINT_STATUS.APPROVING) {
      throw new Error(`当前状态 ${complaint.status} 不允许审批`);
    }

    complaint.addApproval({
      approvalType: 'FINAL',
      operatorId,
      operatorName,
      decision,
      comment
    });

    let result;

    if (decision === 'APPROVE') {
      complaint.changeStatus(COMPLAINT_STATUS.APPROVED, {
        operatorId,
        operatorName,
        description: `审批通过: ${comment}`,
        diffBefore: { status: complaint.status },
        diffAfter: { status: COMPLAINT_STATUS.APPROVED }
      });
      
      complaint.changeStatus(COMPLAINT_STATUS.PAYMENT_PROCESSING, {
        operatorId,
        operatorName,
        description: '进入打款流程'
      });

      result = {
        success: true,
        decision: 'APPROVED',
        status: complaint.status,
        compensationAmount: complaint.trialCalculation?.totalCompensationAmount || 0
      };
    } else {
      complaint.changeStatus(COMPLAINT_STATUS.REJECTED, {
        operatorId,
        operatorName,
        description: `审批驳回: ${comment}`,
        diffBefore: { status: complaint.status },
        diffAfter: { status: COMPLAINT_STATUS.REJECTED }
      });
      complaint.rejectReason = COMPLAINT_REJECT_REASONS.EVIDENCE_INSUFFICIENT;
      complaint.rejectNote = comment;

      result = {
        success: true,
        decision: 'REJECTED',
        status: complaint.status,
        reason: comment
      };
    }

    store.saveComplaint(complaint);

    if (idempotencyKey) {
      complaint.markIdempotency(idempotencyKey, result);
      store.saveComplaint(complaint);
    }

    store.recordOperation({
      type: 'APPROVAL',
      complaintId: complaint.id,
      operatorId,
      operatorName,
      data: {
        decision,
        comment
      }
    });

    return result;
  }

  processPayment(complaintId, paymentData, idempotencyKey = null) {
    if (idempotencyKey) {
      const complaint = store.getComplaintById(complaintId);
      if (complaint) {
        const existing = complaint.checkIdempotency(idempotencyKey);
        if (existing) {
          logger.info('幂等命中: 打款', idempotencyKey);
          return existing.result;
        }
      }
    }

    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    if (complaint.status !== COMPLAINT_STATUS.PAYMENT_PROCESSING) {
      throw new Error(`当前状态 ${complaint.status} 不允许打款`);
    }

    const amount = complaint.trialCalculation?.totalCompensationAmount || 0;

    complaint.addPayment({
      paymentNo: paymentData.paymentNo || 'PAY' + Date.now(),
      amount,
      paymentMethod: paymentData.method || 'BALANCE',
      status: 'PROCESSING'
    });

    store.saveComplaint(complaint);

    const result = {
      success: true,
      paymentNo: complaint.payments[complaint.payments.length - 1].paymentNo,
      amount,
      status: 'PROCESSING'
    };

    if (idempotencyKey) {
      complaint.markIdempotency(idempotencyKey, result);
      store.saveComplaint(complaint);
    }

    store.recordOperation({
      type: 'PAYMENT_INITIATE',
      complaintId: complaint.id,
      data: {
        amount,
        method: paymentData.method
      }
    });

    return result;
  }

  handlePaymentCallback(complaintId, paymentNo, callbackData, idempotencyKey = null) {
    if (idempotencyKey) {
      const complaint = store.getComplaintById(complaintId);
      if (complaint) {
        const existing = complaint.checkIdempotency(idempotencyKey);
        if (existing) {
          logger.info('幂等命中: 回调', idempotencyKey);
          return existing.result;
        }
      }
    }

    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    const payment = complaint.payments.find(p => p.paymentNo === paymentNo);
    if (!payment) {
      throw new Error('支付记录不存在');
    }

    if (payment.status !== 'PROCESSING') {
      logger.info('支付回调重复处理', paymentNo, payment.status);
      return {
        success: true,
        alreadyProcessed: true,
        paymentNo,
        previousStatus: payment.status
      };
    }

    const beforeStatus = payment.status;
    payment.callbackTime = new Date();
    payment.callbackResult = callbackData.result;

    if (callbackData.success) {
      payment.status = 'SUCCESS';
      complaint.changeStatus(COMPLAINT_STATUS.COMPLETED, {
        operatorId: 'SYSTEM',
        operatorName: '系统',
        description: `打款成功，支付单号: ${paymentNo}`,
        diffBefore: { paymentStatus: beforeStatus, complaintStatus: complaint.status },
        diffAfter: { paymentStatus: 'SUCCESS', complaintStatus: COMPLAINT_STATUS.COMPLETED }
      });
    } else {
      payment.status = 'FAILED';
      complaint.status = COMPLAINT_STATUS.EXCEPTION;
      complaint.exceptionReason = `支付失败: ${callbackData.errorMessage || '未知错误'}`;
      complaint.history.push({
        id: generateId(),
        action: 'PAYMENT_FAILED',
        fromStatus: COMPLAINT_STATUS.PAYMENT_PROCESSING,
        toStatus: COMPLAINT_STATUS.EXCEPTION,
        operatorId: 'SYSTEM',
        operatorName: '系统',
        description: complaint.exceptionReason,
        diffBefore: { paymentStatus: beforeStatus },
        diffAfter: { paymentStatus: 'FAILED', exceptionReason: complaint.exceptionReason },
        timestamp: new Date()
      });
    }

    store.saveComplaint(complaint);

    const result = {
      success: true,
      paymentNo,
      paymentStatus: payment.status,
      complaintStatus: complaint.status
    };

    if (idempotencyKey) {
      complaint.markIdempotency(idempotencyKey, result);
      store.saveComplaint(complaint);
    }

    store.recordOperation({
      type: 'PAYMENT_CALLBACK',
      complaintId: complaint.id,
      data: {
        paymentNo,
        success: callbackData.success,
        newStatus: payment.status
      }
    });

    return result;
  }

  manualCorrect(complaintId, correctionData, operatorId, operatorName) {
    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    const diffBefore = {};
    const diffAfter = {};

    if (correctionData.status !== undefined && correctionData.status !== complaint.status) {
      diffBefore.status = complaint.status;
      diffAfter.status = correctionData.status;
      complaint.status = correctionData.status;
    }

    if (correctionData.rejectReason !== undefined) {
      diffBefore.rejectReason = complaint.rejectReason;
      diffAfter.rejectReason = correctionData.rejectReason;
      complaint.rejectReason = correctionData.rejectReason;
    }

    if (correctionData.rejectNote !== undefined) {
      diffBefore.rejectNote = complaint.rejectNote;
      diffAfter.rejectNote = correctionData.rejectNote;
      complaint.rejectNote = correctionData.rejectNote;
    }

    if (correctionData.exceptionReason !== undefined) {
      diffBefore.exceptionReason = complaint.exceptionReason;
      diffAfter.exceptionReason = correctionData.exceptionReason;
      complaint.exceptionReason = correctionData.exceptionReason;
    }

    if (correctionData.trialCalculation && complaint.trialCalculation) {
      diffBefore.trialCalculation = {
        totalCompensationAmount: complaint.trialCalculation.totalCompensationAmount,
        totalShortageWeight: complaint.trialCalculation.totalShortageWeight
      };
      
      if (correctionData.trialCalculation.totalCompensationAmount !== undefined) {
        complaint.trialCalculation.totalCompensationAmount = correctionData.trialCalculation.totalCompensationAmount;
      }
      
      diffAfter.trialCalculation = {
        totalCompensationAmount: complaint.trialCalculation.totalCompensationAmount,
        totalShortageWeight: complaint.trialCalculation.totalShortageWeight
      };
    }

    complaint.history.push({
      id: generateId(),
      action: 'MANUAL_CORRECTION',
      fromStatus: diffBefore.status || complaint.status,
      toStatus: diffAfter.status || complaint.status,
      operatorId,
      operatorName,
      description: correctionData.description || '人工修正',
      diffBefore,
      diffAfter,
      timestamp: new Date()
    });

    complaint.updatedAt = new Date();
    store.saveComplaint(complaint);

    store.recordOperation({
      type: 'MANUAL_CORRECTION',
      complaintId: complaint.id,
      operatorId,
      operatorName,
      data: {
        diffBefore,
        diffAfter,
        description: correctionData.description
      }
    });

    return {
      success: true,
      diffBefore,
      diffAfter,
      operator: {
        id: operatorId,
        name: operatorName
      }
    };
  }

  retryException(complaintId, operatorId, operatorName) {
    const complaint = store.getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('投诉不存在');
    }

    if (complaint.status !== COMPLAINT_STATUS.EXCEPTION) {
      throw new Error(`当前状态 ${complaint.status} 不是异常状态`);
    }

    const beforeStatus = complaint.status;
    const beforeException = complaint.exceptionReason;

    if (complaint.payments.some(p => p.status === 'FAILED')) {
      complaint.status = COMPLAINT_STATUS.PAYMENT_PROCESSING;
    } else {
      complaint.status = COMPLAINT_STATUS.APPROVING;
    }

    complaint.history.push({
      id: generateId(),
      action: 'EXCEPTION_RETRY',
      fromStatus: beforeStatus,
      toStatus: complaint.status,
      operatorId,
      operatorName,
      description: `重试异常，原因为: ${beforeException}`,
      diffBefore: { status: beforeStatus, exceptionReason: beforeException },
      diffAfter: { status: complaint.status },
      timestamp: new Date()
    });

    complaint.exceptionReason = null;
    complaint.updatedAt = new Date();
    store.saveComplaint(complaint);

    store.recordOperation({
      type: 'EXCEPTION_RETRY',
      complaintId: complaint.id,
      operatorId,
      operatorName,
      data: {
        beforeStatus,
        newStatus: complaint.status,
        originalException: beforeException
      }
    });

    return {
      success: true,
      oldStatus: beforeStatus,
      newStatus: complaint.status
    };
  }

  getComplaint(complaintIdOrNo) {
    return store.getComplaintById(complaintIdOrNo) || store.getComplaintByNo(complaintIdOrNo);
  }

  getComplaintDetail(complaintId) {
    const complaint = this.getComplaint(complaintId);
    if (!complaint) {
      return null;
    }

    const order = orderService.getOrder(complaint.orderId);
    const weightChain = orderService.getOrderWeightChain(order.id);

    return {
      complaint: {
        id: complaint.id,
        complaintNo: complaint.complaintNo,
        orderId: complaint.orderId,
        orderNo: complaint.orderNo,
        userId: complaint.userId,
        groupLeaderId: complaint.groupLeaderId,
        status: complaint.status,
        description: complaint.description,
        filedTime: complaint.filedTime,
        rejectReason: complaint.rejectReason,
        rejectNote: complaint.rejectNote,
        exceptionReason: complaint.exceptionReason,
        isDuplicateOf: complaint.isDuplicateOf
      },
      weightChain,
      complaintItems: complaint.complaintItems,
      evidences: complaint.evidences,
      trialCalculation: complaint.trialCalculation,
      approvals: complaint.approvals,
      payments: complaint.payments,
      history: complaint.history.map(h => ({
        id: h.id,
        action: h.action,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        operatorId: h.operatorId,
        operatorName: h.operatorName,
        description: h.description,
        diffBefore: h.diffBefore,
        diffAfter: h.diffAfter,
        timestamp: h.timestamp,
        ip: h.ip
      }))
    };
  }

  queryComplaints(filter) {
    return store.queryComplaints(filter);
  }

  getStatistics(filter = {}) {
    const complaints = this.queryComplaints(filter);
    const total = complaints.length;
    const statusStats = {};
    const reasonStats = {};
    let totalCompensation = 0;
    let paidCompensation = 0;

    complaints.forEach(c => {
      statusStats[c.status] = (statusStats[c.status] || 0) + 1;
      
      if (c.rejectReason) {
        reasonStats[c.rejectReason] = (reasonStats[c.rejectReason] || 0) + 1;
      }

      if (c.trialCalculation) {
        totalCompensation += c.trialCalculation.totalCompensationAmount;
      }

      if (c.status === COMPLAINT_STATUS.COMPLETED && c.trialCalculation) {
        paidCompensation += c.trialCalculation.totalCompensationAmount;
      }
    });

    const leaderStats = {};
    complaints.forEach(c => {
      const gl = c.groupLeaderId;
      if (!leaderStats[gl]) {
        leaderStats[gl] = {
          groupLeaderId: gl,
          totalComplaints: 0,
          rejectedComplaints: 0,
          approvedComplaints: 0,
          totalCompensation: 0
        };
      }
      leaderStats[gl].totalComplaints++;
      
      if (c.status === COMPLAINT_STATUS.REJECTED) {
        leaderStats[gl].rejectedComplaints++;
      }
      if (c.status === COMPLAINT_STATUS.COMPLETED || c.status === COMPLAINT_STATUS.APPROVED) {
        leaderStats[gl].approvedComplaints++;
        if (c.trialCalculation) {
          leaderStats[gl].totalCompensation += c.trialCalculation.totalCompensationAmount;
        }
      }
    });

    return {
      totalComplaints: total,
      statusStats,
      reasonStats,
      totalCompensation,
      paidCompensation,
      pendingCompensation: totalCompensation - paidCompensation,
      groupLeaderResponsibility: Object.values(leaderStats).map(stat => ({
        ...stat,
        rejectRate: stat.totalComplaints > 0 ? (stat.rejectedComplaints / stat.totalComplaints * 100).toFixed(2) : '0.00'
      }))
    };
  }

  exportReport(filter = {}) {
    const complaints = this.queryComplaints(filter);
    const stats = this.getStatistics(filter);

    const detailRows = complaints.map(c => {
      const order = orderService.getOrder(c.orderId);
      const isPaid = c.status === COMPLAINT_STATUS.COMPLETED;
      const lastPayment = c.payments.length > 0 ? c.payments[c.payments.length - 1] : null;
      
      return {
        投诉单号: c.complaintNo,
        订单号: c.orderNo,
        用户ID: c.userId,
        团长ID: c.groupLeaderId,
        投诉状态: c.status,
        投诉时间: c.filedTime ? new Date(c.filedTime).toISOString() : '',
        投诉商品数: c.complaintItems.length,
        证据数: c.evidences.length,
        赔付金额: c.trialCalculation?.totalCompensationAmount || 0,
        是否打款: isPaid ? '是' : '否',
        支付单号: lastPayment?.paymentNo || '',
        驳回原因: c.rejectReason || '',
        驳回说明: c.rejectNote || '',
        异常原因: c.exceptionReason || ''
      };
    });

    return {
      summary: {
        totalComplaints: stats.totalComplaints,
        statusStats: stats.statusStats,
        rejectReasonStats: stats.reasonStats,
        totalCompensation: stats.totalCompensation,
        paidCompensation: stats.paidCompensation,
        groupLeaderStats: stats.groupLeaderResponsibility
      },
      details: detailRows,
      generatedAt: new Date().toISOString(),
      filter
    };
  }
}

module.exports = new ComplaintService();
