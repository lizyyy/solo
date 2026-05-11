const { v4: uuidv4 } = require('uuid');

const stores = new Map();
const coupons = new Map();
const redeemRequests = new Map();
const auditLogs = new Map();
const statistics = {
  totalRedeemed: 0,
  abnormalCodes: new Set(),
  refundBlocked: 0,
  pendingReview: new Set()
};

function initSampleData() {
  stores.set('STORE001', {
    id: 'STORE001',
    name: '美味轩中餐厅（上海南京路店）',
    city: '上海',
    categories: ['餐饮'],
    allowedCategories: ['FOOD']
  });
  stores.set('STORE002', {
    id: 'STORE002',
    name: '北京烤鸭店（北京王府井店）',
    city: '北京',
    categories: ['餐饮'],
    allowedCategories: ['FOOD']
  });
  stores.set('STORE003', {
    id: 'STORE003',
    name: '欢乐亲子乐园（上海迪士尼店）',
    city: '上海',
    categories: ['亲子'],
    allowedCategories: ['FAMILY']
  });
  stores.set('STORE004', {
    id: 'STORE004',
    name: '宝贝王国（北京欢乐谷店）',
    city: '北京',
    categories: ['亲子'],
    allowedCategories: ['FAMILY']
  });

  coupons.set('COUP001', {
    id: 'COUP001',
    code: 'FOOD-SH-001-ABC123',
    name: '上海餐饮100元代金券',
    category: 'FOOD',
    value: 100,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    boundStores: ['STORE001'],
    status: 'ACTIVE',
    redeemedAt: null,
    redeemedBy: null,
    refundedAt: null,
    createdAt: new Date()
  });

  coupons.set('COUP002', {
    id: 'COUP002',
    code: 'FOOD-BJ-002-XYZ789',
    name: '北京餐饮80元代金券',
    category: 'FOOD',
    value: 80,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    boundStores: ['STORE002'],
    status: 'ACTIVE',
    redeemedAt: null,
    redeemedBy: null,
    refundedAt: null,
    createdAt: new Date()
  });

  coupons.set('COUP003', {
    id: 'COUP003',
    code: 'FAMILY-SH-003-DEF456',
    name: '上海亲子乐园单人票',
    category: 'FAMILY',
    value: 150,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    boundStores: ['STORE003'],
    status: 'ACTIVE',
    redeemedAt: null,
    redeemedBy: null,
    refundedAt: null,
    createdAt: new Date()
  });

  coupons.set('COUP004', {
    id: 'COUP004',
    code: 'FAMILY-BJ-004-GHI012',
    name: '北京亲子乐园亲子票',
    category: 'FAMILY',
    value: 200,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    boundStores: ['STORE004'],
    status: 'REFUNDED',
    redeemedAt: null,
    redeemedBy: null,
    refundedAt: new Date('2026-05-01'),
    createdAt: new Date()
  });

  coupons.set('COUP005', {
    id: 'COUP005',
    code: 'FOOD-SH-005-JKL345',
    name: '上海餐饮50元代金券',
    category: 'FOOD',
    value: 50,
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    boundStores: ['STORE001'],
    status: 'REDEEMED',
    redeemedAt: new Date('2026-05-10'),
    redeemedBy: 'STORE001',
    refundedAt: null,
    createdAt: new Date()
  });
}

function generateCode(prefix, category) {
  return `${prefix}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

module.exports = {
  stores,
  coupons,
  redeemRequests,
  auditLogs,
  statistics,
  initSampleData,
  generateCode
};
