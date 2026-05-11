const { v4: uuidv4 } = require('uuid');

const PLANS = {
  monthly_standard: {
    id: 'monthly_standard',
    name: '月度标准版',
    price: 99,
    cycle_days: 30,
    trial_days: 7
  },
  yearly_standard: {
    id: 'yearly_standard',
    name: '年度标准版',
    price: 999,
    cycle_days: 365,
    trial_days: 7,
    is_yearly: true,
    monthly_equivalent: 83.25
  },
  monthly_pro: {
    id: 'monthly_pro',
    name: '月度专业版',
    price: 199,
    cycle_days: 30,
    trial_days: 7
  },
  yearly_pro: {
    id: 'yearly_pro',
    name: '年度专业版',
    price: 1999,
    cycle_days: 365,
    trial_days: 7,
    is_yearly: true,
    monthly_equivalent: 166.58
  }
};

const COUPONS = {
  NEW_USER_50: {
    id: 'NEW_USER_50',
    name: '新用户50元优惠券',
    type: 'fixed',
    value: 50,
    min_amount: 100
  },
  FIRST_YEAR_200: {
    id: 'FIRST_YEAR_200',
    name: '首年减免200元',
    type: 'fixed',
    value: 200,
    min_amount: 800,
    for_yearly: true
  },
  SUMMER_10: {
    id: 'SUMMER_10',
    name: '夏季9折券',
    type: 'percentage',
    value: 0.1,
    max_discount: 100
  }
};

const REFUND_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_SUPERVISOR: 'needs_supervisor'
};

const STORE = {
  subscriptions: [],
  orders: [],
  refundRequests: [],
  operationLogs: [],
  agents: [
    { id: 'AGENT_001', name: '张小明', role: 'agent' },
    { id: 'AGENT_002', name: '李小红', role: 'agent' },
    { id: 'SUP_001', name: '王主管', role: 'supervisor' }
  ]
};

function generateId() {
  return uuidv4();
}

function getPlan(planId) {
  return PLANS[planId] || null;
}

function getCoupon(couponId) {
  return COUPONS[couponId] || null;
}

function getAgent(agentId) {
  return STORE.agents.find(a => a.id === agentId) || null;
}

function createLog(agentId, action, targetType, targetId, details) {
  const log = {
    id: generateId(),
    agentId,
    agentName: getAgent(agentId)?.name || '未知操作员',
    action,
    targetType,
    targetId,
    details: details || {},
    createdAt: new Date().toISOString()
  };
  STORE.operationLogs.push(log);
  return log;
}

function findSubscription(subscriptionId) {
  return STORE.subscriptions.find(s => s.id === subscriptionId);
}

function findOrder(orderId) {
  return STORE.orders.find(o => o.id === orderId);
}

function findRefundRequest(refundId) {
  return STORE.refundRequests.find(r => r.id === refundId);
}

function findRefundRequestsByOrder(orderId) {
  return STORE.refundRequests.filter(r => r.orderId === orderId);
}

function saveSubscription(subscription) {
  STORE.subscriptions.push(subscription);
  return subscription;
}

function saveOrder(order) {
  STORE.orders.push(order);
  return order;
}

function saveRefundRequest(request) {
  STORE.refundRequests.push(request);
  return request;
}

module.exports = {
  PLANS,
  COUPONS,
  REFUND_STATUS,
  STORE,
  generateId,
  getPlan,
  getCoupon,
  getAgent,
  createLog,
  findSubscription,
  findOrder,
  findRefundRequest,
  findRefundRequestsByOrder,
  saveSubscription,
  saveOrder,
  saveRefundRequest
};
