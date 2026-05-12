const { v4: uuidv4 } = require('uuid');

let tickets = new Map();
let prechecks = new Map();
let approvals = new Map();
let executions = new Map();
let rollbacks = new Map();
let audits = new Map();

let orders = new Map();
let members = new Map();
let invoices = new Map();

const initMockData = () => {
  orders.set('ORD001', {
    id: 'ORD001',
    user_id: 'USER001',
    status: 'PAID',
    amount: 299.00,
    product: 'VIP会员年卡',
    created_at: '2025-01-15T10:00:00Z'
  });
  orders.set('ORD002', {
    id: 'ORD002',
    user_id: 'USER002',
    status: 'SHIPPED',
    amount: 599.00,
    product: '耳机套装',
    created_at: '2025-01-16T14:30:00Z'
  });
  orders.set('ORD003', {
    id: 'ORD003',
    user_id: 'USER003',
    status: 'DELIVERED',
    amount: 1299.00,
    product: '手机',
    created_at: '2025-01-14T09:00:00Z'
  });

  members.set('USER001', {
    id: 'USER001',
    name: '张三',
    level: 'GOLD',
    points: 5000,
    balance: 100.00,
    vip_expire_at: '2025-12-31T23:59:59Z'
  });
  members.set('USER002', {
    id: 'USER002',
    name: '李四',
    level: 'SILVER',
    points: 2000,
    balance: 50.00,
    vip_expire_at: '2025-06-30T23:59:59Z'
  });

  invoices.set('INV001', {
    id: 'INV001',
    order_id: 'ORD001',
    status: 'PENDING',
    amount: 299.00,
    tax_rate: 0.13,
    created_at: '2025-01-15T10:05:00Z'
  });
  invoices.set('INV002', {
    id: 'INV002',
    order_id: 'ORD003',
    status: 'ISSUED',
    amount: 1299.00,
    tax_rate: 0.13,
    created_at: '2025-01-14T10:00:00Z'
  });
};

const generateId = () => uuidv4();

module.exports = {
  tickets,
  prechecks,
  approvals,
  executions,
  rollbacks,
  audits,
  orders,
  members,
  invoices,
  initMockData,
  generateId
};
