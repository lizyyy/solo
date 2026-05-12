const { v4: uuidv4 } = require('uuid');

const store = {
  retentionPolicies: new Map(),
  freezes: new Map(),
  archiveTasks: new Map(),
  recoveryRequests: new Map(),
  auditLogs: [],
  businessData: {
    orders: new Map(),
    tickets: new Map(),
    messages: new Map()
  },
  archiveStorage: {
    orders: new Map(),
    tickets: new Map(),
    messages: new Map()
  }
};

function initSampleData() {
  const now = Date.now();
  const threeYearsAgo = now - 3 * 365 * 24 * 60 * 60 * 1000;
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  store.businessData.orders.set('ORD-2022-001', {
    id: 'ORD-2022-001',
    type: 'order',
    createdAt: threeYearsAgo,
    amount: 1500,
    customer: '张三',
    status: 'completed',
    archiveStatus: 'active'
  });

  store.businessData.orders.set('ORD-2022-002', {
    id: 'ORD-2022-002',
    type: 'order',
    createdAt: threeYearsAgo + 10 * 24 * 60 * 60 * 1000,
    amount: 2800,
    customer: '李四',
    status: 'completed',
    archiveStatus: 'active'
  });

  store.businessData.orders.set('ORD-2023-001', {
    id: 'ORD-2023-001',
    type: 'order',
    createdAt: oneYearAgo,
    amount: 999,
    customer: '王五',
    status: 'completed',
    archiveStatus: 'active'
  });

  store.businessData.orders.set('ORD-2024-001', {
    id: 'ORD-2024-001',
    type: 'order',
    createdAt: sixMonthsAgo,
    amount: 599,
    customer: '赵六',
    status: 'completed',
    archiveStatus: 'active'
  });

  store.businessData.tickets.set('TKT-2022-001', {
    id: 'TKT-2022-001',
    type: 'ticket',
    createdAt: threeYearsAgo,
    title: '退换货申请',
    customer: '张三',
    status: 'closed',
    archiveStatus: 'active'
  });

  store.businessData.tickets.set('TKT-2022-002', {
    id: 'TKT-2022-002',
    type: 'ticket',
    createdAt: threeYearsAgo + 5 * 24 * 60 * 60 * 1000,
    title: '投诉处理',
    customer: '陈七',
    status: 'closed',
    archiveStatus: 'active'
  });

  store.businessData.tickets.set('TKT-2023-001', {
    id: 'TKT-2023-001',
    type: 'ticket',
    createdAt: oneYearAgo,
    title: '发票问题',
    customer: '李四',
    status: 'closed',
    archiveStatus: 'active'
  });

  store.businessData.messages.set('MSG-2022-001', {
    id: 'MSG-2022-001',
    type: 'message',
    createdAt: threeYearsAgo,
    content: '订单确认通知',
    recipient: '张三',
    archiveStatus: 'active'
  });

  store.businessData.messages.set('MSG-2022-002', {
    id: 'MSG-2022-002',
    type: 'message',
    createdAt: threeYearsAgo + 20 * 24 * 60 * 60 * 1000,
    content: '促销活动通知',
    recipient: '王五',
    archiveStatus: 'active'
  });

  store.businessData.messages.set('MSG-2024-001', {
    id: 'MSG-2024-001',
    type: 'message',
    createdAt: oneMonthAgo,
    content: '密码重置通知',
    recipient: '赵六',
    archiveStatus: 'active'
  });

  store.freezes.set('freeze-legal-001', {
    id: 'freeze-legal-001',
    dataType: 'order',
    records: ['ORD-2022-002'],
    reason: '法律诉讼取证',
    freezeDate: now - 60 * 24 * 60 * 60 * 1000,
    freezeBy: '法务部-王明',
    active: true
  });

  store.freezes.set('freeze-compliance-001', {
    id: 'freeze-compliance-001',
    dataType: 'ticket',
    records: ['TKT-2022-002'],
    reason: '合规审查',
    freezeDate: now - 30 * 24 * 60 * 60 * 1000,
    freezeBy: '合规部-李华',
    active: true
  });

  store.retentionPolicies.set('policy-order', {
    id: 'policy-order',
    dataType: 'order',
    retentionDays: 730,
    description: '订单数据保留2年',
    createdAt: now - 365 * 24 * 60 * 60 * 1000,
    createdBy: '管理员'
  });

  store.retentionPolicies.set('policy-ticket', {
    id: 'policy-ticket',
    dataType: 'ticket',
    retentionDays: 548,
    description: '工单数据保留1.5年',
    createdAt: now - 365 * 24 * 60 * 60 * 1000,
    createdBy: '管理员'
  });

  store.retentionPolicies.set('policy-message', {
    id: 'policy-message',
    dataType: 'message',
    retentionDays: 180,
    description: '消息记录保留6个月',
    createdAt: now - 365 * 24 * 60 * 60 * 1000,
    createdBy: '管理员'
  });
}

function generateId() {
  return uuidv4();
}

function addAuditLog(entry) {
  store.auditLogs.push({
    id: generateId(),
    timestamp: Date.now(),
    ...entry
  });
}

module.exports = {
  store,
  initSampleData,
  generateId,
  addAuditLog
};
