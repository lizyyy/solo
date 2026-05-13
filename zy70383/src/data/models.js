const SUBSCRIPTION_STATUS = {
  PENDING_VERIFICATION: 'pending_verification',
  ENABLED: 'enabled',
  PAUSED: 'paused',
  NO_PERMISSION: 'no_permission',
  VERIFICATION_FAILED: 'verification_failed'
};

const EVENT_DIRECTORY = [
  { eventId: 'order.created', name: '订单创建事件', description: '用户下单成功时触发', allowedPlans: ['basic', 'pro', 'enterprise'] },
  { eventId: 'order.paid', name: '订单支付事件', description: '订单支付成功时触发', allowedPlans: ['basic', 'pro', 'enterprise'] },
  { eventId: 'order.cancelled', name: '订单取消事件', description: '订单取消时触发', allowedPlans: ['pro', 'enterprise'] },
  { eventId: 'refund.requested', name: '退款申请事件', description: '用户发起退款时触发', allowedPlans: ['pro', 'enterprise'] },
  { eventId: 'refund.completed', name: '退款完成事件', description: '退款完成时触发', allowedPlans: ['pro', 'enterprise'] },
  { eventId: 'member.created', name: '会员注册事件', description: '新会员注册时触发', allowedPlans: ['enterprise'] },
  { eventId: 'member.updated', name: '会员更新事件', description: '会员信息更新时触发', allowedPlans: ['enterprise'] },
  { eventId: 'member.expired', name: '会员过期事件', description: '会员到期时触发', allowedPlans: ['enterprise'] }
];

const CUSTOMER_PLANS = {
  'cust_001': { customerId: 'cust_001', name: '基础套餐客户', plan: 'basic', allowedTenants: ['tenant_a'] },
  'cust_002': { customerId: 'cust_002', name: '专业套餐客户', plan: 'pro', allowedTenants: ['tenant_a', 'tenant_b'] },
  'cust_003': { customerId: 'cust_003', name: '企业套餐客户', plan: 'enterprise', allowedTenants: ['tenant_a', 'tenant_b', 'tenant_c'] },
  'cust_004': { customerId: 'cust_004', name: '企业多租户客户', plan: 'enterprise', allowedTenants: ['tenant_a', 'tenant_c'] }
};

let subscriptions = new Map();
let deliveryStats = new Map();
let verificationTokens = new Map();

module.exports = {
  SUBSCRIPTION_STATUS,
  EVENT_DIRECTORY,
  CUSTOMER_PLANS,
  subscriptions,
  deliveryStats,
  verificationTokens
};
