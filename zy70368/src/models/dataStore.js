const { v4: uuidv4 } = require('uuid');

const dataStore = {
  roles: new Map(),
  policies: new Map(),
  policyVersions: new Map(),
  exceptions: new Map(),
  auditLogs: [],
  mockData: {
    customers: new Map(),
    orders: new Map()
  }
};

function initMockData() {
  dataStore.roles.set('customer_service', {
    id: 'customer_service',
    name: '客服',
    description: '客户服务人员'
  });
  dataStore.roles.set('finance', {
    id: 'finance',
    name: '财务',
    description: '财务人员'
  });
  dataStore.roles.set('outsourcing', {
    id: 'outsourcing',
    name: '外包审计',
    description: '外包审计人员'
  });

  const customerPolicyId = uuidv4();
  dataStore.policies.set(customerPolicyId, {
    id: customerPolicyId,
    name: '客户详情策略',
    resourceType: 'customer',
    description: '客户详情接口字段脱敏策略',
    createdAt: new Date().toISOString(),
    currentVersion: 1
  });

  const customerVersion1Id = uuidv4();
  dataStore.policyVersions.set(customerVersion1Id, {
    id: customerVersion1Id,
    policyId: customerPolicyId,
    version: 1,
    status: 'published',
    publishedAt: new Date().toISOString(),
    fieldRules: {
      customer_service: {
        id: { visible: true },
        name: { visible: true },
        phone: { visible: true, mask: 'last4' },
        email: { visible: true, mask: 'partial' },
        address: { visible: true, mask: 'partial' },
        balance: { visible: false },
        notes: { visible: false },
        createdAt: { visible: true }
      },
      finance: {
        id: { visible: true },
        name: { visible: true },
        phone: { visible: true, mask: 'last4' },
        email: { visible: false },
        address: { visible: false },
        balance: { visible: true },
        notes: { visible: false },
        createdAt: { visible: true }
      },
      outsourcing: {
        id: { visible: true },
        name: { visible: true },
        phone: { visible: false },
        email: { visible: false },
        address: { visible: true, mask: 'full' },
        balance: { visible: false },
        notes: { visible: false },
        createdAt: { visible: true }
      }
    }
  });

  const orderPolicyId = uuidv4();
  dataStore.policies.set(orderPolicyId, {
    id: orderPolicyId,
    name: '订单详情策略',
    resourceType: 'order',
    description: '订单详情接口字段脱敏策略',
    createdAt: new Date().toISOString(),
    currentVersion: 1
  });

  const orderVersion1Id = uuidv4();
  dataStore.policyVersions.set(orderVersion1Id, {
    id: orderVersion1Id,
    policyId: orderPolicyId,
    version: 1,
    status: 'published',
    publishedAt: new Date().toISOString(),
    fieldRules: {
      customer_service: {
        id: { visible: true },
        orderNo: { visible: true },
        customerId: { visible: true },
        amount: { visible: true },
        status: { visible: true },
        productName: { visible: true },
        paymentMethod: { visible: false },
        internalNotes: { visible: false },
        createdAt: { visible: true }
      },
      finance: {
        id: { visible: true },
        orderNo: { visible: true },
        customerId: { visible: true },
        amount: { visible: true },
        status: { visible: true },
        productName: { visible: true },
        paymentMethod: { visible: true },
        internalNotes: { visible: false },
        createdAt: { visible: true }
      },
      outsourcing: {
        id: { visible: true },
        orderNo: { visible: true },
        customerId: { visible: false },
        amount: { visible: true, mask: 'partial' },
        status: { visible: true },
        productName: { visible: true },
        paymentMethod: { visible: false },
        internalNotes: { visible: false },
        createdAt: { visible: true }
      }
    }
  });

  const customer1Id = uuidv4();
  dataStore.mockData.customers.set(customer1Id, {
    id: customer1Id,
    name: '张三',
    phone: '13800138000',
    email: 'zhangsan@example.com',
    address: '北京市朝阳区建国路88号',
    balance: 15680.50,
    notes: 'VIP客户，需要特别服务',
    createdAt: '2024-01-15T10:30:00Z'
  });

  const order1Id = uuidv4();
  dataStore.mockData.orders.set(order1Id, {
    id: order1Id,
    orderNo: 'ORD20240115001',
    customerId: customer1Id,
    amount: 2999.00,
    status: '已完成',
    productName: '高端耳机 Pro Max',
    paymentMethod: '信用卡',
    internalNotes: '客户要求加急处理，已备注',
    createdAt: '2024-01-15T14:20:00Z'
  });

  const exception1Id = uuidv4();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  dataStore.exceptions.set(exception1Id, {
    id: exception1Id,
    userId: 'user_outsourcing_special',
    role: 'outsourcing',
    resourceType: 'customer',
    resourceId: customer1Id,
    grantedFields: ['phone', 'email'],
    expiresAt: futureDate.toISOString(),
    reason: '特殊审计需求，临时授权查看联系方式',
    createdAt: new Date().toISOString()
  });

  const expiredExceptionId = uuidv4();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);
  dataStore.exceptions.set(expiredExceptionId, {
    id: expiredExceptionId,
    userId: 'user_outsourcing_expired',
    role: 'outsourcing',
    resourceType: 'customer',
    resourceId: customer1Id,
    grantedFields: ['phone'],
    expiresAt: pastDate.toISOString(),
    reason: '已过期的临时授权',
    createdAt: pastDate.toISOString()
  });

  return {
    customerPolicyId,
    customerVersion1Id,
    orderPolicyId,
    orderVersion1Id,
    customer1Id,
    order1Id
  };
}

module.exports = {
  dataStore,
  initMockData
};
