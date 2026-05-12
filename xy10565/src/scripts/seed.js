const dbManager = require('../db/database');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Device = require('../models/Device');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

async function createSeedData() {
  await dbManager.initialize();

  console.log('\n========================================');
  console.log('  开始创建样例数据...');
  console.log('========================================\n');

  const customer1 = Customer.create({
    id: uuidv4(),
    name: '张三',
    phone: '13800138001',
    email: 'zhangsan@example.com',
    address: '北京市朝阳区xxx街道xxx号'
  });
  console.log('✅ 创建客户: 张三 (正常换新流程)');

  const customer2 = Customer.create({
    id: uuidv4(),
    name: '李四',
    phone: '13800138002',
    email: 'lisi@example.com',
    address: '上海市浦东新区xxx路xxx号'
  });
  console.log('✅ 创建客户: 李四 (库存不足流程)');

  const customer3 = Customer.create({
    id: uuidv4(),
    name: '王五',
    phone: '13800138003',
    email: 'wangwu@example.com',
    address: '广州市天河区xxx大道xxx号'
  });
  console.log('✅ 创建客户: 王五 (原机逾期流程)');

  const customer4 = Customer.create({
    id: uuidv4(),
    name: '赵六',
    phone: '13800138004',
    email: 'zhaoliu@example.com',
    address: '深圳市南山区xxx科技园'
  });
  console.log('✅ 创建客户: 赵六 (重复申请流程)');

  const productPhone = Product.create({
    id: uuidv4(),
    sku: 'PHONE-001',
    name: '智能手机 Pro Max',
    category: '手机',
    original_warranty_months: 12,
    description: '高端智能手机，256GB，黑色'
  });
  console.log('✅ 创建产品: 智能手机 Pro Max');

  const productTablet = Product.create({
    id: uuidv4(),
    sku: 'TABLET-001',
    name: '平板设备 Air',
    category: '平板',
    original_warranty_months: 12,
    description: '10.9寸平板设备'
  });
  console.log('✅ 创建产品: 平板设备 Air');

  const deviceOld1 = Device.create({
    id: uuidv4(),
    sn: 'SN2024PH001',
    product_id: productPhone.id,
    is_new: 0,
    status: 'AVAILABLE',
    warranty_start_date: dayjs().subtract(6, 'month').format('YYYY-MM-DD'),
    warranty_end_date: dayjs().add(6, 'month').format('YYYY-MM-DD'),
    current_owner_id: customer1.id,
    notes: '客户张三正在使用，已使用6个月'
  });
  console.log('✅ 创建设备: 原机 (张三使用中，剩余6个月保修)');

  const deviceOld2 = Device.create({
    id: uuidv4(),
    sn: 'SN2024PH002',
    product_id: productPhone.id,
    is_new: 0,
    status: 'AVAILABLE',
    warranty_start_date: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
    warranty_end_date: dayjs().add(9, 'month').format('YYYY-MM-DD'),
    current_owner_id: customer2.id,
    notes: '客户李四正在使用'
  });
  console.log('✅ 创建设备: 原机 (李四使用中)');

  const deviceOld3 = Device.create({
    id: uuidv4(),
    sn: 'SN2024PH003',
    product_id: productPhone.id,
    is_new: 0,
    status: 'AVAILABLE',
    warranty_start_date: dayjs().subtract(8, 'month').format('YYYY-MM-DD'),
    warranty_end_date: dayjs().add(4, 'month').format('YYYY-MM-DD'),
    current_owner_id: customer3.id,
    notes: '客户王五正在使用'
  });
  console.log('✅ 创建设备: 原机 (王五使用中)');

  const deviceOld4 = Device.create({
    id: uuidv4(),
    sn: 'SN2024PH004',
    product_id: productPhone.id,
    is_new: 0,
    status: 'AVAILABLE',
    warranty_start_date: dayjs().subtract(2, 'month').format('YYYY-MM-DD'),
    warranty_end_date: dayjs().add(10, 'month').format('YYYY-MM-DD'),
    current_owner_id: customer4.id,
    notes: '客户赵六正在使用'
  });
  console.log('✅ 创建设备: 原机 (赵六使用中)');

  const newDevices = [
    { sn: 'SN2025NEW001', owner: null },
    { sn: 'SN2025NEW002', owner: null },
    { sn: 'SN2025NEW003', owner: null }
  ];

  for (const d of newDevices) {
    Device.create({
      id: uuidv4(),
      sn: d.sn,
      product_id: productPhone.id,
      is_new: 1,
      status: 'AVAILABLE',
      warranty_start_date: null,
      warranty_end_date: null,
      current_owner_id: d.owner,
      notes: '库存新机，待分配'
    });
    console.log(`✅ 创建设备: 新机 ${d.sn}`);
  }

  const tabletNew = Device.create({
    id: uuidv4(),
    sn: 'SN2025TAB001',
    product_id: productTablet.id,
    is_new: 1,
    status: 'AVAILABLE',
    warranty_start_date: null,
    warranty_end_date: null,
    current_owner_id: null,
    notes: '平板库存新机'
  });
  console.log(`✅ 创建设备: 平板新机 ${tabletNew.sn}`);

  dbManager.close();

  console.log('\n========================================');
  console.log('  样例数据创建完成！');
  console.log('========================================\n');
  console.log('创建的数据:');
  console.log('  - 4个客户: 张三、李四、王五、赵六');
  console.log('  - 2个产品: 智能手机 Pro Max、平板设备 Air');
  console.log('  - 8台设备: 4台旧机(客户使用中) + 4台新机(库存)');
  console.log('\n样例场景:');
  console.log('  1. 张三: 正常换新流程（有库存、有回收、完整闭环）');
  console.log('  2. 李四: 库存不足场景（产品无库存）');
  console.log('  3. 王五: 原机逾期场景（回收逾期）');
  console.log('  4. 赵六: 重复申请场景（同一设备重复申请）');
  console.log('\n');

  return {
    customers: { customer1, customer2, customer3, customer4 },
    products: { productPhone, productTablet },
    devices: { deviceOld1, deviceOld2, deviceOld3, deviceOld4 }
  };
}

if (require.main === module) {
  createSeedData().catch(err => {
    console.error('创建样例数据失败:', err);
    process.exit(1);
  });
}

module.exports = createSeedData;
