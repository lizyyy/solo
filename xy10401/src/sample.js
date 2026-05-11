const {
  generateId,
  saveSubscription,
  saveOrder,
  saveRefundRequest,
  createLog,
  getPlan,
  REFUND_STATUS
} = require('./models');

const SAMPLE_USERS = [
  { id: 'USER_1001', name: '测试用户-张三' },
  { id: 'USER_1002', name: '测试用户-李四' },
  { id: 'USER_1003', name: '测试用户-王五' },
  { id: 'USER_1004', name: '测试用户-赵六' },
  { id: 'USER_1005', name: '测试用户-孙七' }
];

const AGENT_001 = 'AGENT_001';
const AGENT_002 = 'AGENT_002';
const SUP_001 = 'SUP_001';

function createDateOffset(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date;
}

function initializeSampleData() {
  console.log('正在初始化样例数据...');

  const now = new Date();

  const sub1 = {
    id: generateId(),
    userId: SAMPLE_USERS[0].id,
    userName: SAMPLE_USERS[0].name,
    planId: 'monthly_standard',
    planName: '月度标准版',
    cycleDays: 30,
    trialDays: 7,
    originalPrice: 99,
    status: 'active',
    createdAt: createDateOffset(-2).toISOString(),
    trialEndAt: createDateOffset(5).toISOString(),
    expireAt: createDateOffset(28).toISOString()
  };
  saveSubscription(sub1);

  const order1 = {
    id: generateId(),
    subscriptionId: sub1.id,
    userId: sub1.userId,
    userName: sub1.userName,
    planId: sub1.planId,
    planName: sub1.planName,
    originalPrice: 99,
    couponId: null,
    couponName: null,
    couponDiscount: 0,
    paidAmount: 99,
    paymentDate: createDateOffset(-2).toISOString(),
    cycleStartAt: createDateOffset(-2).toISOString(),
    cycleEndAt: createDateOffset(28).toISOString(),
    status: 'paid',
    refundedAmount: 0,
    refundStatus: 'none'
  };
  saveOrder(order1);

  createLog(AGENT_001, 'create_subscription', 'subscription', sub1.id, {
    userId: sub1.userId,
    userName: sub1.userName,
    planId: sub1.planId
  });
  createLog(AGENT_001, 'register_payment', 'order', order1.id, {
    subscriptionId: sub1.id,
    paidAmount: order1.paidAmount
  });

  const sub2 = {
    id: generateId(),
    userId: SAMPLE_USERS[1].id,
    userName: SAMPLE_USERS[1].name,
    planId: 'yearly_standard',
    planName: '年度标准版',
    cycleDays: 365,
    trialDays: 7,
    originalPrice: 999,
    status: 'active',
    createdAt: createDateOffset(-90).toISOString(),
    trialEndAt: createDateOffset(-83).toISOString(),
    expireAt: createDateOffset(275).toISOString()
  };
  saveSubscription(sub2);

  const order2 = {
    id: generateId(),
    subscriptionId: sub2.id,
    userId: sub2.userId,
    userName: sub2.userName,
    planId: sub2.planId,
    planName: sub2.planName,
    originalPrice: 999,
    couponId: 'FIRST_YEAR_200',
    couponName: '首年减免200元',
    couponDiscount: 200,
    paidAmount: 799,
    paymentDate: createDateOffset(-90).toISOString(),
    cycleStartAt: createDateOffset(-90).toISOString(),
    cycleEndAt: createDateOffset(275).toISOString(),
    status: 'paid',
    refundedAmount: 0,
    refundStatus: 'none'
  };
  saveOrder(order2);

  createLog(AGENT_002, 'create_subscription', 'subscription', sub2.id, {
    userId: sub2.userId,
    userName: sub2.userName,
    planId: sub2.planId
  });
  createLog(AGENT_002, 'register_payment', 'order', order2.id, {
    subscriptionId: sub2.id,
    couponId: 'FIRST_YEAR_200',
    couponDiscount: 200,
    paidAmount: order2.paidAmount
  });

  const sub3 = {
    id: generateId(),
    userId: SAMPLE_USERS[2].id,
    userName: SAMPLE_USERS[2].name,
    planId: 'monthly_pro',
    planName: '月度专业版',
    cycleDays: 30,
    trialDays: 7,
    originalPrice: 199,
    status: 'active',
    createdAt: createDateOffset(-35).toISOString(),
    trialEndAt: createDateOffset(-28).toISOString(),
    expireAt: createDateOffset(-5).toISOString()
  };
  saveSubscription(sub3);

  const order3 = {
    id: generateId(),
    subscriptionId: sub3.id,
    userId: sub3.userId,
    userName: sub3.userName,
    planId: sub3.planId,
    planName: sub3.planName,
    originalPrice: 199,
    couponId: 'NEW_USER_50',
    couponName: '新用户50元优惠券',
    couponDiscount: 50,
    paidAmount: 149,
    paymentDate: createDateOffset(-35).toISOString(),
    cycleStartAt: createDateOffset(-35).toISOString(),
    cycleEndAt: createDateOffset(-5).toISOString(),
    status: 'paid',
    refundedAmount: 0,
    refundStatus: 'none'
  };
  saveOrder(order3);

  const sub4 = {
    id: generateId(),
    userId: SAMPLE_USERS[3].id,
    userName: SAMPLE_USERS[3].name,
    planId: 'yearly_pro',
    planName: '年度专业版',
    cycleDays: 365,
    trialDays: 7,
    originalPrice: 1999,
    status: 'active',
    createdAt: createDateOffset(-30).toISOString(),
    trialEndAt: createDateOffset(-23).toISOString(),
    expireAt: createDateOffset(335).toISOString()
  };
  saveSubscription(sub4);

  const order4 = {
    id: generateId(),
    subscriptionId: sub4.id,
    userId: sub4.userId,
    userName: sub4.userName,
    planId: sub4.planId,
    planName: sub4.planName,
    originalPrice: 1999,
    couponId: 'SUMMER_10',
    couponName: '夏季9折券',
    couponDiscount: 199.9,
    paidAmount: 1799.1,
    paymentDate: createDateOffset(-30).toISOString(),
    cycleStartAt: createDateOffset(-30).toISOString(),
    cycleEndAt: createDateOffset(335).toISOString(),
    status: 'paid',
    refundedAmount: 0,
    refundStatus: 'none'
  };
  saveOrder(order4);

  const sub5 = {
    id: generateId(),
    userId: SAMPLE_USERS[4].id,
    userName: SAMPLE_USERS[4].name,
    planId: 'monthly_standard',
    planName: '月度标准版',
    cycleDays: 30,
    trialDays: 7,
    originalPrice: 99,
    status: 'active',
    createdAt: createDateOffset(-10).toISOString(),
    trialEndAt: createDateOffset(-3).toISOString(),
    expireAt: createDateOffset(20).toISOString()
  };
  saveSubscription(sub5);

  const order5 = {
    id: generateId(),
    subscriptionId: sub5.id,
    userId: sub5.userId,
    userName: sub5.userName,
    planId: sub5.planId,
    planName: sub5.planName,
    originalPrice: 99,
    couponId: null,
    couponName: null,
    couponDiscount: 0,
    paidAmount: 99,
    paymentDate: createDateOffset(-10).toISOString(),
    cycleStartAt: createDateOffset(-10).toISOString(),
    cycleEndAt: createDateOffset(20).toISOString(),
    status: 'paid',
    refundedAmount: 0,
    refundStatus: 'none'
  };
  saveOrder(order5);

  const refund1 = {
    id: generateId(),
    orderId: order3.id,
    subscriptionId: sub3.id,
    userId: sub3.userId,
    userName: sub3.userName,
    agentId: AGENT_001,
    reason: '用户反馈功能不符合预期，申请退款',
    originalOrderPrice: 199,
    couponDiscount: 50,
    paidAmount: 149,
    usedDays: 30,
    usedAmount: 149,
    refundAmount: 0,
    details: '月付按实际使用天数折算',
    isZeroRefund: true,
    status: REFUND_STATUS.APPROVED,
    needsSupervisor: false,
    supervisorDecision: 'approved',
    createdAt: now.toISOString(),
    reviewedAt: now.toISOString(),
    autoApproved: true,
    idempotencyKey: generateId()
  };
  saveRefundRequest(refund1);
  order3.refundedAmount = 0;
  order3.refundStatus = 'partial_refunded';

  createLog(AGENT_001, 'submit_refund', 'refund_request', refund1.id, {
    orderId: order3.id,
    refundAmount: 0,
    reason: refund1.reason
  });

  const refund2 = {
    id: generateId(),
    orderId: order1.id,
    subscriptionId: sub1.id,
    userId: sub1.userId,
    userName: sub1.userName,
    agentId: AGENT_002,
    reason: '试用期内取消订阅',
    originalOrderPrice: 99,
    couponDiscount: 0,
    paidAmount: 99,
    usedDays: 0,
    usedAmount: 0,
    refundAmount: 99,
    details: '试用期内全额退款',
    isZeroRefund: false,
    status: REFUND_STATUS.PENDING,
    needsSupervisor: false,
    supervisorDecision: null,
    createdAt: createDateOffset(-0.5).toISOString(),
    reviewedAt: null,
    idempotencyKey: generateId()
  };
  saveRefundRequest(refund2);

  createLog(AGENT_002, 'submit_refund', 'refund_request', refund2.id, {
    orderId: order1.id,
    refundAmount: 99,
    reason: refund2.reason
  });

  const refund3 = {
    id: generateId(),
    orderId: order4.id,
    subscriptionId: sub4.id,
    userId: sub4.userId,
    userName: sub4.userName,
    agentId: AGENT_001,
    reason: '企业账号停用，申请全额退款',
    originalOrderPrice: 1999,
    couponDiscount: 199.9,
    paidAmount: 1799.1,
    usedDays: 30,
    usedAmount: 147.87,
    refundAmount: 1651.23,
    details: '年付按实际使用天数折算',
    isZeroRefund: false,
    status: REFUND_STATUS.NEEDS_SUPERVISOR,
    needsSupervisor: true,
    supervisorDecision: null,
    createdAt: createDateOffset(-0.2).toISOString(),
    reviewedAt: null,
    idempotencyKey: generateId()
  };
  saveRefundRequest(refund3);

  createLog(AGENT_001, 'submit_refund', 'refund_request', refund3.id, {
    orderId: order4.id,
    refundAmount: 1651.23,
    reason: refund3.reason,
    needsSupervisor: true
  });

  global.SAMPLE_ORDER_IDS = {
    trialOrder: order1.id,
    yearlyCouponOrder: order2.id,
    zeroRefundOrder: order3.id,
    highValueOrder: order4.id,
    normalOrder: order5.id
  };

  global.SAMPLE_REFUND_IDS = {
    zeroRefund: refund1.id,
    pendingRefund: refund2.id,
    needsSupervisorRefund: refund3.id
  };

  console.log('样例数据初始化完成！');
  console.log('');
  console.log('样例订单列表:');
  console.log(`  1. ${order1.userName} - ${order1.planName} - ¥${order1.paidAmount} (试用期内，可全额退款)`);
  console.log(`     订单ID: ${order1.id}`);
  console.log(`  2. ${order2.userName} - ${order2.planName} - ¥${order2.paidAmount} (年付+优惠券200)`);
  console.log(`     订单ID: ${order2.id}`);
  console.log(`  3. ${order3.userName} - ${order3.planName} - ¥${order3.paidAmount} (已到期，零退款)`);
  console.log(`     订单ID: ${order3.id}`);
  console.log(`  4. ${order4.userName} - ${order4.planName} - ¥${order4.paidAmount} (年付9折，大额退款需主管)`);
  console.log(`     订单ID: ${order4.id}`);
  console.log(`  5. ${order5.userName} - ${order5.planName} - ¥${order5.paidAmount} (普通订单)`);
  console.log(`     订单ID: ${order5.id}`);
  console.log('');
  console.log('现有退款申请:');
  console.log(`  1. 零退款已自动处理 - 退款ID: ${refund1.id}`);
  console.log(`  2. 待审核 (试用期全额) - 退款ID: ${refund2.id}`);
  console.log(`  3. 待主管审批 (大额¥1651.23) - 退款ID: ${refund3.id}`);
}

module.exports = { initializeSampleData };
