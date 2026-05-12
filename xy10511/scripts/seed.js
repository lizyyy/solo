const moment = require('moment');
const db = require('../src/db');
const maintenanceService = require('../src/services/maintenanceService');

console.log('========================================');
console.log('  物业设备保修管理系统 - 初始化演示数据');
console.log('========================================\n');

const seedData = async () => {
  await db.loadDb();
  console.log('📦 正在创建维保商...\n');

  const vendor1 = maintenanceService.createVendor({
    name: '东方电梯维保有限公司',
    contact: '张工',
    phone: '13800138001',
    email: 'service@dongfang-elevator.com',
    service_area: 'A区、B区电梯设备'
  });
  console.log(`  ✓ 维保商1: ${vendor1.name}`);

  const vendor2 = maintenanceService.createVendor({
    name: '金诚空调技术服务中心',
    contact: '李工',
    phone: '13800138002',
    email: 'service@jincheng-ac.com',
    service_area: '中央空调系统'
  });
  console.log(`  ✓ 维保商2: ${vendor2.name}`);

  const vendor3 = maintenanceService.createVendor({
    name: '智慧安防科技有限公司',
    contact: '王工',
    phone: '13800138003',
    email: 'service@smart-security.com',
    service_area: '门禁、安防系统'
  });
  console.log(`  ✓ 维保商3: ${vendor3.name}`);

  console.log('\n🏢 正在创建资产...\n');

  const today = moment();

  const asset1 = maintenanceService.createAsset({
    asset_code: 'ELEV-A01-001',
    name: 'A栋1号客梯',
    type: 'elevator',
    location: 'A栋1-20层',
    installation_date: today.subtract(2, 'years').format('YYYY-MM-DD'),
    warranty_start_date: today.subtract(2, 'years').format('YYYY-MM-DD'),
    warranty_end_date: today.add(1, 'years').format('YYYY-MM-DD'),
    manufacturer: '三菱电机',
    model: 'LEHY-III',
    vendor_id: vendor1.id
  });
  console.log(`  ✓ 资产1: ${asset1.name} (保内)`);

  const asset2 = maintenanceService.createAsset({
    asset_code: 'ELEV-B01-002',
    name: 'B栋2号货梯',
    type: 'elevator',
    location: 'B栋1-15层',
    installation_date: today.subtract(5, 'years').format('YYYY-MM-DD'),
    warranty_start_date: today.subtract(5, 'years').format('YYYY-MM-DD'),
    warranty_end_date: today.subtract(2, 'years').format('YYYY-MM-DD'),
    manufacturer: '奥的斯',
    model: 'Gen2',
    vendor_id: vendor1.id
  });
  console.log(`  ✓ 资产2: ${asset2.name} (保外)`);

  const asset3 = maintenanceService.createAsset({
    asset_code: 'AC-CENTRAL-001',
    name: '中央空调主机',
    type: 'air_conditioner',
    location: '楼顶机房',
    installation_date: today.subtract(3, 'years').format('YYYY-MM-DD'),
    warranty_start_date: today.subtract(3, 'years').format('YYYY-MM-DD'),
    warranty_end_date: today.add(2, 'years').format('YYYY-MM-DD'),
    manufacturer: '大金',
    model: 'VRV X7',
    vendor_id: vendor2.id
  });
  console.log(`  ✓ 资产3: ${asset3.name} (保内)`);

  const asset4 = maintenanceService.createAsset({
    asset_code: 'ACCESS-MAIN-001',
    name: '主入口门禁系统',
    type: 'access_control',
    location: '园区主入口',
    installation_date: today.subtract(4, 'years').format('YYYY-MM-DD'),
    warranty_start_date: today.subtract(4, 'years').format('YYYY-MM-DD'),
    warranty_end_date: today.subtract(1, 'years').format('YYYY-MM-DD'),
    manufacturer: '海康威视',
    model: 'DS-K2801',
    vendor_id: vendor3.id
  });
  console.log(`  ✓ 资产4: ${asset4.name} (保外)`);

  console.log('\n========================================');
  console.log('  演示数据创建完成！');
  console.log('========================================');
  console.log('\n📊 资产清单:');
  console.log('  1. A栋1号客梯 - 保内 (电梯类)');
  console.log('  2. B栋2号货梯 - 保外 (电梯类)');
  console.log('  3. 中央空调主机 - 保内 (空调类)');
  console.log('  4. 主入口门禁系统 - 保外 (门禁类)');
  console.log('\n🔧 维保商清单:');
  console.log('  1. 东方电梯维保有限公司');
  console.log('  2. 金诚空调技术服务中心');
  console.log('  3. 智慧安防科技有限公司');
  console.log('\n💡 下一步:');
  console.log('  - npm run demo          运行主演示流程');
  console.log('  - npm run demo-failure  运行失败场景演示');
  console.log('  - npm start             启动API服务');
  console.log('');

  return {
    vendors: [vendor1, vendor2, vendor3],
    assets: [asset1, asset2, asset3, asset4]
  };
};

seedData().catch(console.error);
