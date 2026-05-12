const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const defaultData = {
  tenants: [
    { id: 't1', name: '黄金VIP租户A', level: 'VIP_GOLD', vipExempt: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 't2', name: '白银VIP租户B', level: 'VIP_SILVER', vipExempt: true, createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 't3', name: '普通租户C', level: 'NORMAL', vipExempt: false, createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 't4', name: '普通租户D', level: 'NORMAL', vipExempt: false, createdAt: '2026-01-04T00:00:00.000Z' },
    { id: 't5', name: '黄金VIP租户E', level: 'VIP_GOLD', vipExempt: true, createdAt: '2026-01-05T00:00:00.000Z' },
  ],
  interfaceGroups: [
    { id: 'g1', name: '核心交易接口', description: '下单、支付、退款等核心接口', interfaces: ['/api/order/create', '/api/order/pay', '/api/order/refund'] },
    { id: 'g2', name: '查询接口', description: '订单查询、商品查询等读接口', interfaces: ['/api/order/list', '/api/order/detail', '/api/product/list'] },
    { id: 'g3', name: '用户接口', description: '用户信息相关接口', interfaces: ['/api/user/info', '/api/user/login'] },
  ],
  regions: [
    { code: 'CN-EAST', name: '华东地区' },
    { code: 'CN-NORTH', name: '华北地区' },
    { code: 'CN-SOUTH', name: '华南地区' },
    { code: 'CN-WEST', name: '西部地区' },
    { code: 'DEFAULT', name: '默认(全国)' },
  ],
  rules: [
    {
      id: 'r1',
      name: '核心交易-华东-普通租户限流',
      type: 'COMBINED',
      tenantLevel: 'NORMAL',
      interfaceGroupId: 'g1',
      regionCode: 'CN-EAST',
      limitType: 'QPS',
      limitValue: 100,
      windowSeconds: 60,
      priority: 50,
      vipExempt: true,
      status: 'DRAFT',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'r2',
      name: '查询接口-全国-限流',
      type: 'GLOBAL',
      interfaceGroupId: 'g2',
      regionCode: 'DEFAULT',
      limitType: 'QPS',
      limitValue: 500,
      windowSeconds: 60,
      priority: 30,
      vipExempt: false,
      status: 'DRAFT',
      createdAt: '2026-05-02T00:00:00.000Z',
    },
    {
      id: 'r3',
      name: '核心交易-华南-整体限流',
      type: 'GLOBAL',
      interfaceGroupId: 'g1',
      regionCode: 'CN-SOUTH',
      limitType: 'QPS',
      limitValue: 200,
      windowSeconds: 60,
      priority: 80,
      vipExempt: false,
      status: 'DRAFT',
      createdAt: '2026-05-03T00:00:00.000Z',
    },
  ],
  releases: [],
  hitLogs: [],
  currentRelease: null,
};

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return JSON.parse(JSON.stringify(defaultData));
  }
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(content);
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return uuidv4();
}

module.exports = {
  loadData,
  saveData,
  generateId,
  defaultData,
};
