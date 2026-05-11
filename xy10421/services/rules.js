const store = require('../data/store');

const LEVEL_RULES = {
  P1: {
    name: '低级问题',
    maxPercentage: 0.10,
    needsApproval: false
  },
  P2: {
    name: '中级问题',
    maxPercentage: 0.20,
    needsApproval: false
  },
  P3: {
    name: '高级问题',
    maxPercentage: 0.50,
    needsApproval: true
  }
};

const ORDER_CUMULATIVE_LIMIT = 0.50;

function isValidLevel(level) {
  return LEVEL_RULES.hasOwnProperty(level);
}

function getLevelRule(level) {
  return LEVEL_RULES[level];
}

function getOrderCumulativeTotal(orderId) {
  const compensations = store.getCompensationsByOrderId(orderId);
  return compensations.reduce((sum, c) => sum + c.amount, 0);
}

function calculateMaxCompensation(order, level) {
  const rule = getLevelRule(level);
  if (!rule) {
    throw new Error('Invalid problem level');
  }
  
  const levelMax = order.amount * rule.maxPercentage;
  const cumulativeTotal = getOrderCumulativeTotal(order.orderId);
  const globalMax = order.amount * ORDER_CUMULATIVE_LIMIT;
  const remaining = globalMax - cumulativeTotal;
  
  return Math.min(levelMax, Math.max(0, remaining));
}

function evaluateCompensation(order, level, requestedAmount) {
  const rule = getLevelRule(level);
  const maxForLevel = calculateMaxCompensation(order, level);
  const cumulativeTotal = getOrderCumulativeTotal(order.orderId);
  const globalMax = order.amount * ORDER_CUMULATIVE_LIMIT;
  const newTotal = cumulativeTotal + requestedAmount;
  
  const result = {
    level,
    orderAmount: order.amount,
    maxForLevel,
    cumulativeTotal,
    globalMax,
    requestedAmount,
    canApprove: false,
    needsApproval: rule.needsApproval,
    reason: ''
  };
  
  if (requestedAmount > maxForLevel) {
    result.reason = `申请金额 ${requestedAmount} 超过该等级最高可赔 ${maxForLevel}`;
    return result;
  }
  
  if (newTotal > globalMax) {
    result.reason = `累计赔付 ${newTotal} 超过订单累计上限 ${globalMax}（订单金额的50%）`;
    return result;
  }
  
  result.canApprove = true;
  if (rule.needsApproval) {
    result.reason = '金额符合规则，需主管审批';
  } else {
    result.reason = '金额符合规则，自动通过';
  }
  
  return result;
}

module.exports = {
  LEVEL_RULES,
  ORDER_CUMULATIVE_LIMIT,
  isValidLevel,
  getLevelRule,
  getOrderCumulativeTotal,
  calculateMaxCompensation,
  evaluateCompensation
};
