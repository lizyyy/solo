const { daysBetween } = require('../utils/date');

const COMPENSATION_RULES = {
  normal: {
    delay: {
      basePerDay: 20,
      maxDays: 30,
      maxAmount: 500,
      minAmount: 0
    },
    damage: {
      percentage: 0.3,
      maxAmount: 1000,
      minAmount: 100,
      requireEvidence: true,
      minEvidenceCount: 2
    },
    lost: {
      percentage: 1.0,
      maxAmount: 2000,
      minAmount: 200,
      requireLiabilityConfirmation: true
    }
  },
  vip: {
    delay: {
      basePerDay: 30,
      maxDays: 30,
      maxAmount: 1000,
      minAmount: 50
    },
    damage: {
      percentage: 0.5,
      maxAmount: 2000,
      minAmount: 200,
      requireEvidence: true,
      minEvidenceCount: 2
    },
    lost: {
      percentage: 1.0,
      maxAmount: 5000,
      minAmount: 500,
      requireLiabilityConfirmation: true
    }
  },
  vip_plus: {
    delay: {
      basePerDay: 50,
      maxDays: 30,
      maxAmount: 2000,
      minAmount: 100
    },
    damage: {
      percentage: 0.7,
      maxAmount: 3000,
      minAmount: 300,
      requireEvidence: true,
      minEvidenceCount: 2
    },
    lost: {
      percentage: 1.0,
      maxAmount: 10000,
      minAmount: 1000,
      requireLiabilityConfirmation: true
    }
  }
};

const FORCE_MAJEURE_EVENTS = [
  '台风', '地震', '洪水', '暴雨', '暴雪', '疫情封控',
  '交通管制', '政府指令', '自然灾害', '不可抗力'
];

const STATUS_FLOW = {
  created: ['awaiting_evidence', 'pending_liability'],
  awaiting_evidence: ['pending_liability', 'evidence_rejected'],
  evidence_rejected: ['awaiting_evidence', 'closed'],
  pending_liability: ['liability_confirmed', 'liability_pending_carrier'],
  liability_pending_carrier: ['liability_confirmed', 'liability_rejected'],
  liability_confirmed: ['compensation_calculated'],
  compensation_calculated: ['pending_review'],
  pending_review: ['review_approved', 'review_rejected'],
  review_approved: ['completed', 'appealed'],
  review_rejected: ['pending_liability', 'closed'],
  appealed: ['appeal_approved', 'appeal_rejected'],
  appeal_approved: ['completed'],
  appeal_rejected: ['review_approved', 'closed'],
  completed: [],
  closed: []
};

function checkForceMajeure(trackingEvents, description) {
  const allEvents = [...trackingEvents];
  if (description) {
    allEvents.push({ location: '', status: description });
  }
  
  for (const event of allEvents) {
    for (const keyword of FORCE_MAJEURE_EVENTS) {
      if (event.status && event.status.includes(keyword)) {
        return {
          isForceMajeure: true,
          event: event,
          keyword: keyword
        };
      }
    }
  }
  
  return {
    isForceMajeure: false,
    event: null,
    keyword: null
  };
}

function validateDamageEvidence(evidences) {
  const validEvidences = evidences.filter(e => e.type === 'photo' || e.type === 'video');
  
  if (validEvidences.length < 2) {
    return {
      valid: false,
      reason: `证据不足，至少需要 2 张照片或视频，当前仅有 ${validEvidences.length} 个有效证据`
    };
  }
  
  return {
    valid: true,
    evidenceCount: validEvidences.length
  };
}

function checkDuplicateAppeal(appeals) {
  const pendingOrApproved = appeals.filter(a => 
    a.status === 'pending' || a.status === 'approved'
  );
  
  if (pendingOrApproved.length > 0) {
    return {
      isDuplicate: true,
      existingAppeal: pendingOrApproved[0],
      reason: '已有待处理或已通过的申诉'
    };
  }
  
  const recentAppeals = appeals.filter(a => {
    const appealDate = new Date(a.createdAt);
    const daysSince = (Date.now() - appealDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  });
  
  if (recentAppeals.length >= 2) {
    return {
      isDuplicate: true,
      existingAppeal: recentAppeals[0],
      reason: '7 天内申诉次数超过限制'
    };
  }
  
  return {
    isDuplicate: false
  };
}

function calculateDelayCompensation(shipment, rules) {
  const { actualDeliveryTime, expectedDeliveryTime } = shipment;
  const delayDays = daysBetween(expectedDeliveryTime, actualDeliveryTime);
  
  if (delayDays <= 0) {
    return {
      amount: 0,
      delayDays: 0,
      calculation: '未延误'
    };
  }
  
  const effectiveDays = Math.min(delayDays, rules.maxDays);
  let amount = effectiveDays * rules.basePerDay;
  
  amount = Math.min(amount, rules.maxAmount);
  amount = Math.max(amount, rules.minAmount);
  
  return {
    amount: Math.round(amount * 100) / 100,
    delayDays,
    effectiveDays,
    basePerDay: rules.basePerDay,
    maxAmount: rules.maxAmount,
    calculation: `延误 ${delayDays} 天，按 ${rules.basePerDay} 元/天计算，上限 ${rules.maxAmount} 元`
  };
}

function calculateDamageCompensation(shipment, rules, evidenceValid) {
  const { insuredAmount, damagePercentage } = shipment;
  
  if (!evidenceValid) {
    return {
      amount: 0,
      reason: '证据不足，需要至少 2 张破损照片',
      calculation: '证据审核未通过'
    };
  }
  
  const damageRatio = damagePercentage ? damagePercentage / 100 : rules.percentage;
  let amount = insuredAmount * damageRatio;
  
  amount = Math.min(amount, rules.maxAmount);
  amount = Math.max(amount, rules.minAmount);
  
  return {
    amount: Math.round(amount * 100) / 100,
    insuredAmount,
    damageRatio,
    maxAmount: rules.maxAmount,
    minAmount: rules.minAmount,
    calculation: `保价金额 ${insuredAmount} 元，破损比例 ${damageRatio * 100}%，最高赔付 ${rules.maxAmount} 元`
  };
}

function calculateLostCompensation(shipment, rules, liabilityConfirmed) {
  const { insuredAmount } = shipment;
  
  if (!liabilityConfirmed) {
    return {
      amount: 0,
      reason: '承运商责任待确认',
      calculation: '需要先确认承运商责任'
    };
  }
  
  let amount = insuredAmount * rules.percentage;
  amount = Math.min(amount, rules.maxAmount);
  amount = Math.max(amount, rules.minAmount);
  
  return {
    amount: Math.round(amount * 100) / 100,
    insuredAmount,
    percentage: rules.percentage * 100,
    maxAmount: rules.maxAmount,
    calculation: `保价金额 ${insuredAmount} 元，按 ${rules.percentage * 100}% 赔付，上限 ${rules.maxAmount} 元`
  };
}

function calculateCompensation(shipment, evidences, liabilities) {
  const customerLevel = shipment.customerLevel || 'normal';
  const rules = COMPENSATION_RULES[customerLevel] || COMPENSATION_RULES.normal;
  const typeRules = rules[shipment.type];
  
  const forceMajeure = checkForceMajeure(
    shipment.trackingEvents || [],
    shipment.description
  );
  
  if (forceMajeure.isForceMajeure && shipment.type === 'delay') {
    return {
      amount: 0,
      status: 'rejected',
      reason: `不可抗力因素：${forceMajeure.keyword}`,
      forceMajeure: true,
      calculation: `因不可抗力 ${forceMajeure.keyword} 造成的延误，不予赔付`
    };
  }
  
  const evidenceCheck = validateDamageEvidence(evidences || []);
  
  const latestLiability = liabilities && liabilities.length > 0 
    ? liabilities[liabilities.length - 1] 
    : null;
  const liabilityConfirmed = latestLiability && latestLiability.status === 'confirmed';
  
  let result;
  switch (shipment.type) {
    case 'delay':
      result = calculateDelayCompensation(shipment, typeRules);
      break;
    case 'damage':
      result = calculateDamageCompensation(shipment, typeRules, evidenceCheck.valid);
      break;
    case 'lost':
      result = calculateLostCompensation(shipment, typeRules, liabilityConfirmed);
      break;
    default:
      return {
        amount: 0,
        status: 'rejected',
        reason: '未知的异常类型',
        calculation: '无法计算赔付金额'
      };
  }
  
  if (result.amount <= 0) {
    return {
      ...result,
      status: 'rejected'
    };
  }
  
  return {
    ...result,
    status: 'pending',
    customerLevel,
    forceMajeure: forceMajeure.isForceMajeure
  };
}

function canTransitionStatus(fromStatus, toStatus) {
  const validTransitions = STATUS_FLOW[fromStatus] || [];
  return validTransitions.includes(toStatus);
}

function getNextPossibleStatuses(currentStatus) {
  return STATUS_FLOW[currentStatus] || [];
}

module.exports = {
  COMPENSATION_RULES,
  FORCE_MAJEURE_EVENTS,
  STATUS_FLOW,
  checkForceMajeure,
  validateDamageEvidence,
  checkDuplicateAppeal,
  calculateCompensation,
  calculateDelayCompensation,
  calculateDamageCompensation,
  calculateLostCompensation,
  canTransitionStatus,
  getNextPossibleStatuses
};
