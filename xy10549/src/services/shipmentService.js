const store = require('../data/store');
const { formatDate, now } = require('../utils/date');
const { recordHistory, recordStatusChange, recordManualEdit } = require('./history');
const { calculateCompensation, canTransitionStatus, checkDuplicateAppeal, getNextPossibleStatuses } = require('./rules');

function generateTrackingSummary(trackingEvents) {
  if (!trackingEvents || trackingEvents.length === 0) {
    return '暂无轨迹信息';
  }
  
  const latest = trackingEvents[trackingEvents.length - 1];
  return `共 ${trackingEvents.length} 个节点，最新状态：[${latest.location}] ${latest.status}`;
}

function importWaybill(waybillData) {
  const existing = store.getWaybill(waybillData.waybillId);
  if (existing) {
    return {
      success: false,
      error: '运单已存在',
      waybill: existing
    };
  }
  
  const waybill = {
    ...waybillData,
    importedAt: formatDate(now()),
    status: 'imported'
  };
  
  store.addWaybill(waybill);
  
  return {
    success: true,
    waybill
  };
}

function createExceptionShipment(data) {
  const required = ['waybillId', 'type', 'description', 'customerLevel'];
  
  for (const field of required) {
    if (!data[field]) {
      return {
        success: false,
        error: `缺少必填字段: ${field}`
      };
    }
  }
  
  const validTypes = ['delay', 'damage', 'lost'];
  if (!validTypes.includes(data.type)) {
    return {
      success: false,
      error: `无效的异常类型: ${data.type}，有效值: ${validTypes.join(', ')}`
    };
  }
  
  const validLevels = ['normal', 'vip', 'vip_plus'];
  if (!validLevels.includes(data.customerLevel)) {
    return {
      success: false,
      error: `无效的客户等级: ${data.customerLevel}，有效值: ${validLevels.join(', ')}`
    };
  }
  
  const waybill = store.getWaybill(data.waybillId);
  
  const shipment = {
    waybillId: data.waybillId,
    type: data.type,
    description: data.description,
    customerLevel: data.customerLevel,
    customerName: data.customerName || waybill?.customerName || '未知客户',
    carrier: data.carrier || waybill?.carrier || '未知承运商',
    origin: data.origin || waybill?.origin || '',
    destination: data.destination || waybill?.destination || '',
    expectedDeliveryTime: data.expectedDeliveryTime || waybill?.expectedDeliveryTime || formatDate(now()),
    actualDeliveryTime: data.actualDeliveryTime || waybill?.actualDeliveryTime || null,
    insuredAmount: data.insuredAmount || waybill?.insuredAmount || 0,
    itemValue: data.itemValue || waybill?.itemValue || 0,
    damagePercentage: data.damagePercentage || 0,
    trackingEvents: data.trackingEvents || waybill?.trackingEvents || [],
    status: 'created',
    statusReason: '异常登记成功',
    createdAt: formatDate(now()),
    updatedAt: formatDate(now()),
    operator: data.operator || 'system'
  };
  
  const result = store.addShipment(shipment);
  
  recordHistory(result.shipmentId, 'created', shipment.operator, {
    waybillId: shipment.waybillId,
    type: shipment.type,
    description: shipment.description
  });
  
  return {
    success: true,
    shipment: result
  };
}

function uploadEvidence(shipmentId, evidenceData, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  const evidence = {
    shipmentId,
    type: evidenceData.type || 'photo',
    url: evidenceData.url || `evidence://${shipmentId}/${Date.now()}`,
    description: evidenceData.description || '',
    uploadedAt: formatDate(now()),
    uploadedBy: operator
  };
  
  const result = store.addEvidence(evidence);
  
  recordHistory(shipmentId, 'evidence_uploaded', operator, {
    evidenceId: result.evidenceId,
    evidenceType: evidence.type,
    description: evidence.description
  });
  
  const currentStatus = shipment.status;
  if (currentStatus === 'awaiting_evidence' || currentStatus === 'evidence_rejected') {
    recordStatusChange(shipmentId, 'pending_liability', operator, '证据已上传，待责任判定');
  }
  
  return {
    success: true,
    evidence: result
  };
}

function judgeLiability(shipmentId, judgmentData, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  if (!judgmentData.status) {
    return {
      success: false,
      error: '缺少责任判定状态'
    };
  }
  
  const validStatuses = ['confirmed', 'pending_carrier', 'rejected'];
  if (!validStatuses.includes(judgmentData.status)) {
    return {
      success: false,
      error: `无效的责任状态: ${judgmentData.status}`
    };
  }
  
  const judgment = {
    shipmentId,
    status: judgmentData.status,
    responsibleParty: judgmentData.responsibleParty || '',
    responsiblePercentage: judgmentData.responsiblePercentage || 100,
    reason: judgmentData.reason || '',
    judgedAt: formatDate(now()),
    judgedBy: operator
  };
  
  const result = store.addLiabilityJudgment(judgment);
  
  recordHistory(shipmentId, 'liability_judged', operator, {
    liabilityId: result.liabilityId,
    liabilityResult: judgment.status,
    responsibleParty: judgment.responsibleParty,
    reason: judgment.reason
  });
  
  let newStatus;
  let reason;
  
  switch (judgment.status) {
    case 'confirmed':
      newStatus = 'liability_confirmed';
      reason = '承运商责任已确认';
      break;
    case 'pending_carrier':
      newStatus = 'liability_pending_carrier';
      reason = '承运商责任待确认';
      break;
    case 'rejected':
      newStatus = 'liability_rejected';
      reason = '承运商责任判定驳回';
      break;
  }
  
  if (canTransitionStatus(shipment.status, newStatus)) {
    recordStatusChange(shipmentId, newStatus, operator, reason);
  }
  
  return {
    success: true,
    judgment: result
  };
}

function calculateShipmentCompensation(shipmentId, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  const evidences = store.getEvidencesByShipment(shipmentId);
  const liabilities = store.getLiabilityByShipment(shipmentId);
  
  const calculationResult = calculateCompensation(shipment, evidences, liabilities);
  
  const compensation = {
    shipmentId,
    type: shipment.type,
    customerLevel: shipment.customerLevel,
    calculatedAmount: calculationResult.amount,
    status: calculationResult.status,
    reason: calculationResult.reason || '',
    calculation: calculationResult.calculation || '',
    delayDays: calculationResult.delayDays || 0,
    forceMajeure: calculationResult.forceMajeure || false,
    calculatedAt: formatDate(now()),
    calculatedBy: operator
  };
  
  const result = store.addCompensation(compensation);
  
  recordHistory(shipmentId, 'compensation_calculated', operator, {
    compensationId: result.compensationId,
    amount: compensation.calculatedAmount,
    status: compensation.status,
    calculation: compensation.calculation
  });
  
  if (calculationResult.status === 'rejected') {
    recordStatusChange(shipmentId, 'closed', operator, `赔付被拒绝: ${calculationResult.reason || '无具体原因'}`);
  } else {
    recordStatusChange(shipmentId, 'compensation_calculated', operator, '赔付计算完成');
  }
  
  return {
    success: true,
    compensation: result,
    calculationDetail: calculationResult
  };
}

function submitForReview(shipmentId, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  if (shipment.status !== 'compensation_calculated') {
    return {
      success: false,
      error: `当前状态 ${shipment.status} 无法提交审核，需要先完成赔付计算`
    };
  }
  
  const compensation = store.getCompensationByShipment(shipmentId);
  const latestCompensation = compensation && compensation.length > 0 
    ? compensation[compensation.length - 1] 
    : null;
  
  const review = {
    shipmentId,
    compensationId: latestCompensation?.compensationId || '',
    submittedAt: formatDate(now()),
    submittedBy: operator,
    status: 'pending'
  };
  
  const result = store.addReview(review);
  
  recordHistory(shipmentId, 'review_submitted', operator, {
    reviewId: result.reviewId,
    compensationAmount: latestCompensation?.calculatedAmount || 0
  });
  
  recordStatusChange(shipmentId, 'pending_review', operator, '已提交审核');
  
  return {
    success: true,
    review: result
  };
}

function reviewShipment(shipmentId, reviewResult, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  if (shipment.status !== 'pending_review') {
    return {
      success: false,
      error: `当前状态 ${shipment.status} 无法审核`
    };
  }
  
  if (!reviewResult.decision) {
    return {
      success: false,
      error: '缺少审核决策'
    };
  }
  
  const validDecisions = ['approved', 'rejected'];
  if (!validDecisions.includes(reviewResult.decision)) {
    return {
      success: false,
      error: `无效的审核决策: ${reviewResult.decision}`
    };
  }
  
  const reviews = store.getReviewByShipment(shipmentId);
  const latestReview = reviews && reviews.length > 0 
    ? reviews[reviews.length - 1] 
    : null;
  
  if (latestReview) {
    store.addReview({
      ...latestReview,
      decision: reviewResult.decision,
      reason: reviewResult.reason || '',
      reviewedAt: formatDate(now()),
      reviewedBy: operator,
      status: reviewResult.decision
    });
  }
  
  let newStatus;
  let action;
  
  if (reviewResult.decision === 'approved') {
    newStatus = 'review_approved';
    action = 'review_approved';
    
    const compensations = store.getCompensationByShipment(shipmentId);
    if (compensations.length > 0) {
      const latest = compensations[compensations.length - 1];
      store.addCompensation({
        ...latest,
        status: 'approved'
      });
    }
  } else {
    newStatus = 'review_rejected';
    action = 'review_rejected';
  }
  
  recordHistory(shipmentId, action, operator, {
    reason: reviewResult.reason || ''
  });
  
  recordStatusChange(shipmentId, newStatus, operator, reviewResult.reason || '');
  
  return {
    success: true,
    review: {
      decision: reviewResult.decision,
      reason: reviewResult.reason || '',
      reviewedBy: operator
    }
  };
}

function submitAppeal(shipmentId, appealData, operator = 'customer') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  if (shipment.status !== 'review_approved' && shipment.status !== 'review_rejected') {
    return {
      success: false,
      error: `当前状态 ${shipment.status} 无法申诉，需要先完成审核`
    };
  }
  
  const existingAppeals = store.getAppealsByShipment(shipmentId);
  const duplicateCheck = checkDuplicateAppeal(existingAppeals);
  
  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      error: duplicateCheck.reason,
      duplicateInfo: duplicateCheck
    };
  }
  
  const appeal = {
    shipmentId,
    reason: appealData.reason || '',
    newEvidence: appealData.newEvidence || [],
    requestedAmount: appealData.requestedAmount || 0,
    submittedAt: formatDate(now()),
    submittedBy: operator,
    status: 'pending'
  };
  
  const result = store.addAppeal(appeal);
  
  recordHistory(shipmentId, 'appeal_submitted', operator, {
    appealId: result.appealId,
    reason: appeal.reason,
    requestedAmount: appeal.requestedAmount
  });
  
  recordStatusChange(shipmentId, 'appealed', operator, '客户已申诉');
  
  return {
    success: true,
    appeal: result
  };
}

function processAppeal(shipmentId, appealResult, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  if (shipment.status !== 'appealed') {
    return {
      success: false,
      error: `当前状态 ${shipment.status} 无法处理申诉`
    };
  }
  
  if (!appealResult.decision) {
    return {
      success: false,
      error: '缺少申诉处理决策'
    };
  }
  
  const validDecisions = ['approved', 'rejected'];
  if (!validDecisions.includes(appealResult.decision)) {
    return {
      success: false,
      error: `无效的申诉决策: ${appealResult.decision}`
    };
  }
  
  const appeals = store.getAppealsByShipment(shipmentId);
  const latestAppeal = appeals && appeals.length > 0 
    ? appeals[appeals.length - 1] 
    : null;
  
  if (latestAppeal) {
    store.addAppeal({
      ...latestAppeal,
      decision: appealResult.decision,
      reason: appealResult.reason || '',
      newCompensation: appealResult.newCompensation || null,
      processedAt: formatDate(now()),
      processedBy: operator,
      status: appealResult.decision
    });
  }
  
  let newStatus;
  let action;
  
  if (appealResult.decision === 'approved') {
    newStatus = 'appeal_approved';
    action = 'appeal_approved';
  } else {
    newStatus = 'appeal_rejected';
    action = 'appeal_rejected';
  }
  
  recordHistory(shipmentId, action, operator, {
    reason: appealResult.reason || '',
    newCompensation: appealResult.newCompensation
  });
  
  recordStatusChange(shipmentId, newStatus, operator, appealResult.reason || '');
  
  return {
    success: true,
    appeal: {
      decision: appealResult.decision,
      reason: appealResult.reason || '',
      processedBy: operator
    }
  };
}

function completeShipment(shipmentId, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  const finalStatuses = ['review_approved', 'appeal_approved', 'appeal_rejected'];
  if (!finalStatuses.includes(shipment.status)) {
    return {
      success: false,
      error: `当前状态 ${shipment.status} 无法完成结案`
    };
  }
  
  recordStatusChange(shipmentId, 'completed', operator, '异常件已结案');
  
  return {
    success: true,
    message: '异常件已完成结案'
  };
}

function manualEditShipment(shipmentId, changes, reason, operator = 'system') {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return {
      success: false,
      error: '异常件不存在'
    };
  }
  
  const result = recordManualEdit(shipmentId, operator, changes, reason);
  
  return {
    success: true,
    message: '人工修正已记录',
    history: result
  };
}

function processCallback(shipmentId, callbackData, operator = 'carrier') {
  const idempotencyKey = callbackData.idempotencyKey;
  
  if (idempotencyKey) {
    const existing = store.checkIdempotency(idempotencyKey, 'callback');
    if (existing) {
      return {
        success: true,
        idempotent: true,
        result: existing.result
      };
    }
  }
  
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    const errorResult = {
      success: false,
      error: '异常件不存在'
    };
    if (idempotencyKey) {
      store.saveIdempotency(idempotencyKey, 'callback', errorResult);
    }
    return errorResult;
  }
  
  let result;
  
  if (callbackData.type === 'liability_confirmation') {
    result = judgeLiability(shipmentId, {
      status: callbackData.status === 'confirmed' ? 'confirmed' : 'rejected',
      responsibleParty: callbackData.responsibleParty || shipment.carrier,
      reason: callbackData.reason || ''
    }, operator);
  } else {
    result = {
      success: false,
      error: `未知的回调类型: ${callbackData.type}`
    };
  }
  
  if (idempotencyKey) {
    store.saveIdempotency(idempotencyKey, 'callback', result);
  }
  
  recordHistory(shipmentId, 'callback', operator, {
    callbackType: callbackData.type,
    result
  });
  
  return {
    ...result,
    idempotent: false
  };
}

function getShipmentDetail(shipmentId) {
  const shipment = store.getShipment(shipmentId);
  if (!shipment) {
    return null;
  }
  
  const waybill = store.getWaybill(shipment.waybillId);
  const evidences = store.getEvidencesByShipment(shipmentId);
  const liabilities = store.getLiabilityByShipment(shipmentId);
  const compensations = store.getCompensationByShipment(shipmentId);
  const reviews = store.getReviewByShipment(shipmentId);
  const appeals = store.getAppealsByShipment(shipmentId);
  const history = store.getHistoryByShipment(shipmentId);
  
  const latestCompensation = compensations.length > 0 
    ? compensations[compensations.length - 1] 
    : null;
  const latestLiability = liabilities.length > 0 
    ? liabilities[liabilities.length - 1] 
    : null;
  
  return {
    shipment,
    waybill,
    trackingSummary: generateTrackingSummary(shipment.trackingEvents),
    evidences,
    liability: latestLiability,
    compensation: latestCompensation,
    latestReview: reviews.length > 0 ? reviews[reviews.length - 1] : null,
    latestAppeal: appeals.length > 0 ? appeals[appeals.length - 1] : null,
    history,
    nextPossibleStatuses: getNextPossibleStatuses(shipment.status)
  };
}

function getAllShipments(filters = {}) {
  return store.getAllShipments(filters);
}

function getStatistics() {
  return store.getStatistics();
}

module.exports = {
  importWaybill,
  createExceptionShipment,
  uploadEvidence,
  judgeLiability,
  calculateShipmentCompensation,
  submitForReview,
  reviewShipment,
  submitAppeal,
  processAppeal,
  completeShipment,
  manualEditShipment,
  processCallback,
  getShipmentDetail,
  getAllShipments,
  getStatistics,
  generateTrackingSummary
};
