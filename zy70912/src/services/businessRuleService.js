const moment = require('moment');

const RULES = {
  OVERDUE_DAYS: 7,
  COMPENSATION_LEVELS: {
    LOW: { max: 500, level: 'A' },
    MEDIUM: { max: 2000, level: 'B' },
    HIGH: { max: 5000, level: 'C' },
    EXCESS: { level: 'D', needsReview: true }
  },
  RESPONSIBLE_SEGMENTS: ['PEK', 'SHA', 'CAN', 'SZX', 'CTU'],
  MAX_COMPENSATION: 5000
};

function applyBusinessRules(claimData) {
  const result = { ...claimData };
  const reviewReasons = [];

  checkOverdue(result, reviewReasons);
  checkCompensationLevel(result, reviewReasons);
  checkResponsibleSegment(result, reviewReasons);
  checkDataCompleteness(result, reviewReasons);

  result.needs_manual_review = reviewReasons.length > 0;
  result.review_reason = reviewReasons.join('; ');
  result.status = result.needs_manual_review ? 'pending_review' : 'pending';

  return result;
}

function checkOverdue(claimData, reviewReasons) {
  if (claimData.flight_date) {
    const flightDate = moment(claimData.flight_date);
    const now = moment();
    const daysDiff = now.diff(flightDate, 'days');
    
    claimData.is_overdue = daysDiff > RULES.OVERDUE_DAYS;
    
    if (claimData.is_overdue) {
      reviewReasons.push(`超时申报: 航班日期距申报已${daysDiff}天，超过${RULES.OVERDUE_DAYS}天时限`);
    }
  }
}

function checkCompensationLevel(claimData, reviewReasons) {
  const amount = claimData.claim_amount || 0;
  
  if (amount <= 0) {
    claimData.compensation_level = null;
    reviewReasons.push('申诉金额为空或无效');
    return;
  }

  if (amount <= RULES.COMPENSATION_LEVELS.LOW.max) {
    claimData.compensation_level = RULES.COMPENSATION_LEVELS.LOW.level;
  } else if (amount <= RULES.COMPENSATION_LEVELS.MEDIUM.max) {
    claimData.compensation_level = RULES.COMPENSATION_LEVELS.MEDIUM.level;
  } else if (amount <= RULES.COMPENSATION_LEVELS.HIGH.max) {
    claimData.compensation_level = RULES.COMPENSATION_LEVELS.HIGH.level;
  } else {
    claimData.compensation_level = RULES.COMPENSATION_LEVELS.EXCESS.level;
    reviewReasons.push(`赔付超限: 申诉金额${amount}元超过上限${RULES.MAX_COMPENSATION}元，需人工核定`);
  }
}

function checkResponsibleSegment(claimData, reviewReasons) {
  const route = claimData.route || '';
  const segment = claimData.responsible_segment;
  
  if (!segment) {
    for (const port of RULES.RESPONSIBLE_SEGMENTS) {
      if (route.includes(port)) {
        claimData.responsible_segment = port;
        break;
      }
    }
  }
  
  if (!claimData.responsible_segment) {
    reviewReasons.push('责任航段未明确，需人工确认');
  }
}

function checkDataCompleteness(claimData, reviewReasons) {
  if (!claimData.baggage_tag_no || claimData.baggage_tag_no.length < 6) {
    reviewReasons.push('行李牌号不完整');
  }
  if (!claimData.passenger_name) {
    reviewReasons.push('旅客姓名缺失');
  }
  if (!claimData.flight_no) {
    reviewReasons.push('航班号缺失');
  }
}

function validateStatusTransition(oldStatus, newStatus) {
  const validTransitions = {
    pending: ['approved', 'rejected', 'returned', 'pending_review'],
    pending_review: ['approved', 'rejected', 'returned'],
    returned: ['approved', 'rejected', 'pending_review'],
    approved: [],
    rejected: []
  };
  
  return validTransitions[oldStatus]?.includes(newStatus) || false;
}

module.exports = {
  applyBusinessRules,
  validateStatusTransition,
  RULES
};
