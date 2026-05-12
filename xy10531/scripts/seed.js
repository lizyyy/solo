const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const store = require('../src/config/store');

const taxCodes = [
  { tax_code: '85171210', category_code: 'ELEC', category_name: '智能手机', description: '智能手机及配件', tax_rate: 0.13 },
  { tax_code: '85258013', category_code: 'ELEC', category_name: '耳机', description: '蓝牙耳机、有线耳机', tax_rate: 0.13 },
  { tax_code: '85176232', category_code: 'ELEC', category_name: '充电器', description: '手机充电器、电源适配器', tax_rate: 0.13 },
  { tax_code: '61091000', category_code: 'CLTH', category_name: 'T恤', description: '棉制T恤衫', tax_rate: 0.1 },
  { tax_code: '62046200', category_code: 'CLTH', category_name: '裤子', description: '女式长裤', tax_rate: 0.1 },
  { tax_code: '33049900', category_code: 'COSM', category_name: '化妆品', description: '护肤、彩妆产品', tax_rate: 0.15 },
  { tax_code: '85258090', category_code: 'ELEC', category_name: '智能手表', description: '智能穿戴设备', tax_rate: 0.13 },
  { tax_code: '42022100', category_code: 'BAGS', category_name: '箱包', description: '皮革或再生皮革制箱包', tax_rate: 0.1 }
];

console.log('🧹 清理旧数据...');
store.clearAll();

console.log('📋 插入样例税号...');
const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
taxCodes.forEach(tc => {
  store.insert('tax_codes', {
    id: uuidv4(),
    tax_code: tc.tax_code,
    category_code: tc.category_code,
    category_name: tc.category_name,
    description: tc.description,
    tax_rate: tc.tax_rate,
    is_active: 1,
    created_at: now,
    updated_at: now
  });
});

console.log(`✅ 已插入 ${taxCodes.length} 个税号`);

const sampleOrders = [
  {
    order_no: 'DEMO-001-PERFECT',
    description: '【样例1】资料齐全 - 直接放行',
    receiver_name: '张三',
    receiver_id_number: '110101199001011234',
    receiver_id_expiry_date: '2030-12-31',
    items: [
      { sku_code: 'IPHONE-15', product_name: 'iPhone 15 Pro', quantity: 1, unit_price: 7999, tax_code: '85171210', category_code: 'ELEC' },
      { sku_code: 'AIRPODS-PRO', product_name: 'AirPods Pro', quantity: 1, unit_price: 1899, tax_code: '85258013', category_code: 'ELEC' }
    ],
    has_documents: true
  },
  {
    order_no: 'DEMO-002-NO-DOCS',
    description: '【样例2】缺证件 - 需要补件',
    receiver_name: '李四',
    receiver_id_number: null,
    receiver_id_expiry_date: null,
    items: [
      { sku_code: 'IPHONE-15', product_name: 'iPhone 15 Pro', quantity: 1, unit_price: 7999, tax_code: '85171210', category_code: 'ELEC' }
    ],
    has_documents: false
  },
  {
    order_no: 'DEMO-003-BAD-TAXCODE',
    description: '【样例3】税号错误 - 品类不匹配',
    receiver_name: '王五',
    receiver_id_number: '440101199203045678',
    receiver_id_expiry_date: '2035-06-15',
    items: [
      { sku_code: 'T-SHIRT', product_name: '纯棉T恤', quantity: 2, unit_price: 199, tax_code: '85171210', category_code: 'CLTH' },
      { sku_code: 'PANTS', product_name: '休闲长裤', quantity: 1, unit_price: 399, tax_code: '62046200', category_code: 'CLTH' }
    ],
    has_documents: true
  },
  {
    order_no: 'DEMO-004-IDEM',
    description: '【样例4】幂等性测试 - 重复预检',
    receiver_name: '赵六',
    receiver_id_number: '310101198807089012',
    receiver_id_expiry_date: '2028-03-20',
    items: [
      { sku_code: 'WATCH', product_name: '智能手表', quantity: 1, unit_price: 2499, tax_code: '85258090', category_code: 'ELEC' }
    ],
    has_documents: true
  },
  {
    order_no: 'DEMO-005-EXPIRED',
    description: '【样例5】证件过期 - 拦截',
    receiver_name: '钱七',
    receiver_id_number: '330101198505051111',
    receiver_id_expiry_date: '2020-01-01',
    items: [
      { sku_code: 'COSMETIC', product_name: '护肤套装', quantity: 1, unit_price: 599, tax_code: '33049900', category_code: 'COSM' }
    ],
    has_documents: true
  }
];

console.log('\n📦 插入样例订单...');

sampleOrders.forEach(orderData => {
  const orderId = uuidv4();
  const totalAmount = orderData.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  
  store.insert('orders', {
    id: orderId,
    order_no: orderData.order_no,
    source_order_no: null,
    warehouse_code: 'WH-HK-001',
    destination_country: 'CN',
    receiver_name: orderData.receiver_name,
    receiver_phone: '13800138000',
    receiver_id_number: orderData.receiver_id_number,
    receiver_id_expiry_date: orderData.receiver_id_expiry_date,
    total_amount: totalAmount,
    currency: 'CNY',
    status: 'imported',
    created_at: now,
    updated_at: now,
    created_by: 'seed',
    remark: orderData.description
  });
  
  orderData.items.forEach(item => {
    store.insert('order_items', {
      id: uuidv4(),
      order_id: orderId,
      sku_code: item.sku_code,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_code: item.tax_code,
      category_code: item.category_code,
      weight_kg: 0.5,
      created_at: now
    });
  });
  
  if (orderData.has_documents && orderData.receiver_id_number) {
    store.insert('documents', {
      id: uuidv4(),
      order_id: orderId,
      doc_type: 'id_photo',
      doc_url: `/docs/${orderData.order_no}/id.jpg`,
      doc_hash: null,
      verified_status: 'passed',
      verified_by: 'seed',
      verified_at: now,
      verified_remark: '身份证照片已验证',
      is_valid: 1,
      expiry_date: orderData.receiver_id_expiry_date,
      created_at: now
    });
  }
  
  console.log(`  ✅ ${orderData.order_no} - ${orderData.description}`);
});

console.log(`\n✅ 已插入 ${sampleOrders.length} 个样例订单`);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 样例数据说明:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. DEMO-001-PERFECT: 资料齐全，可直接走完全流程');
console.log('2. DEMO-002-NO-DOCS: 缺少身份证，需要补件');
console.log('3. DEMO-003-BAD-TAXCODE: T恤税号用了手机税号(品类不匹配)');
console.log('4. DEMO-004-IDEM: 用于测试幂等性(重复预检)');
console.log('5. DEMO-005-EXPIRED: 证件已过期');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n🚀 运行 npm run demo 查看自动化演示');
