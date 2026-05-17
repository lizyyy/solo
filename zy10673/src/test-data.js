const store = require('./store');
const service = require('./service');
const { PRICE_STATUS, EXPIRATION_REASONS } = require('./types');

function initTestData() {
  console.log('初始化测试数据...');

  const price1 = store.createPrice({
    customerId: 'C001',
    customerName: '华为技术有限公司',
    customerLevel: 'VIP',
    skuCode: 'SKU-001',
    skuName: '高性能服务器X1',
    skuCategory: '服务器',
    exclusivePrice: 15000,
    originalPrice: 20000,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-12-31',
    operator: 'admin'
  });

  service.transitionStatus(
    price1.id,
    PRICE_STATUS.EXPIRED_PENDING,
    EXPIRATION_REASONS.TIME_EXPIRED,
    'system',
    '协议即将到期'
  );

  service.transitionStatus(
    price1.id,
    PRICE_STATUS.EXPIRED,
    EXPIRATION_REASONS.TIME_EXPIRED,
    'admin',
    '正式失效'
  );

  service.transitionStatus(
    price1.id,
    PRICE_STATUS.RESTORE_REQUESTED,
    EXPIRATION_REASONS.TIME_EXPIRED,
    'sales_001',
    '申请恢复价格'
  );

  const price2 = store.createPrice({
    customerId: 'C001',
    customerName: '华为技术有限公司',
    customerLevel: 'VIP',
    skuCode: 'SKU-002',
    skuName: '企业级路由器R2',
    skuCategory: '网络设备',
    exclusivePrice: 8000,
    originalPrice: 10000,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-12-31',
    operator: 'admin'
  });

  const price3 = store.createPrice({
    customerId: 'C002',
    customerName: '阿里巴巴集团',
    customerLevel: 'SVIP',
    skuCode: 'SKU-001',
    skuName: '高性能服务器X1',
    skuCategory: '服务器',
    exclusivePrice: 14000,
    originalPrice: 20000,
    effectiveDate: '2024-06-01',
    expiryDate: '2025-05-31',
    operator: 'admin'
  });

  console.log(`测试数据初始化完成，共创建 ${store.prices.length} 条价格记录`);
  console.log(`完整流转记录ID: ${price1.id} (生效中→失效待确认→已失效→恢复申请)`);
  console.log(`冲突用例: C001+SKU-001 已有生效价格，再次导入将触发冲突`);
}

const badImportRecords = [
  {
    customerId: 'C001',
    skuCode: 'SKU-001',
    exclusivePrice: 15000,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-12-31'
  },
  {
    customerId: '',
    skuCode: 'SKU-003',
    exclusivePrice: 'invalid',
    effectiveDate: '2024-12-31',
    expiryDate: '2024-01-01'
  },
  {
    customerId: 'C003',
    skuCode: '',
    exclusivePrice: 5000,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-12-31'
  }
];

module.exports = {
  initTestData,
  badImportRecords
};
