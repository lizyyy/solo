const { initDB } = require('../src/database/connection');
const partsService = require('../src/services/partsService');
const engineersService = require('../src/services/engineersService');
const workOrdersService = require('../src/services/workOrdersService');

async function seed() {
  console.log('开始初始化基础数据...\n');
  
  await initDB();
  
  const parts = [
    { part_code: 'MB-001', part_name: '主板 A型', category: '电子部件', unit: '块', price: 1500, initial_quantity: 50, location: 'A-01-01', min_stock: 10 },
    { part_code: 'HD-002', part_name: '硬盘 1TB', category: '存储设备', unit: '块', price: 500, initial_quantity: 100, location: 'A-02-01', min_stock: 20 },
    { part_code: 'RAM-003', part_name: '内存 16GB', category: '电子部件', unit: '条', price: 300, initial_quantity: 80, location: 'A-01-02', min_stock: 15 },
    { part_code: 'PSU-004', part_name: '电源 500W', category: '电源设备', unit: '个', price: 200, initial_quantity: 60, location: 'B-01-01', min_stock: 10 },
    { part_code: 'DISP-005', part_name: '显示器 24寸', category: '显示设备', unit: '台', price: 1200, initial_quantity: 20, location: 'C-01-01', min_stock: 5 }
  ];
  
  console.log('创建备件数据:');
  parts.forEach(part => {
    try {
      const created = partsService.createPart(part, 'seed');
      console.log(`  ✓ ${part.part_code} - ${part.part_name} (库存: ${part.initial_quantity})`);
    } catch (error) {
      console.log(`  ✗ ${part.part_code} - ${error.message}`);
    }
  });
  
  console.log();
  
  const engineers = [
    { engineer_code: 'ENG-001', name: '张明', department: '硬件维修组', phone: '13800000001' },
    { engineer_code: 'ENG-002', name: '李华', department: '硬件维修组', phone: '13800000002' },
    { engineer_code: 'ENG-003', name: '王强', department: '系统维护组', phone: '13800000003' },
    { engineer_code: 'ENG-004', name: '赵伟', department: '网络工程组', phone: '13800000004' }
  ];
  
  console.log('创建工程师数据:');
  engineers.forEach(eng => {
    try {
      const created = engineersService.createEngineer(eng, 'seed');
      console.log(`  ✓ ${eng.engineer_code} - ${eng.name} (${eng.department})`);
    } catch (error) {
      console.log(`  ✗ ${eng.engineer_code} - ${error.message}`);
    }
  });
  
  console.log();
  
  const workOrders = [
    { order_code: 'WO-2024-001', customer_name: '阳光科技有限公司', customer_contact: '陈经理 13900000001', issue_type: '硬件故障' },
    { order_code: 'WO-2024-002', customer_name: '星辰教育集团', customer_contact: '刘主任 13900000002', issue_type: '系统升级' },
    { order_code: 'WO-2024-003', customer_name: '蓝天医疗设备', customer_contact: '王工 13900000003', issue_type: '设备维护' },
    { order_code: 'WO-2024-004', customer_name: '绿叶环保科技', customer_contact: '赵总 13900000004', issue_type: '网络故障' }
  ];
  
  console.log('创建工单数据:');
  workOrders.forEach(wo => {
    try {
      const created = workOrdersService.createWorkOrder(wo, 'seed');
      console.log(`  ✓ ${wo.order_code} - ${wo.customer_name}`);
    } catch (error) {
      console.log(`  ✗ ${wo.order_code} - ${error.message}`);
    }
  });
  
  console.log();
  console.log('基础数据初始化完成！');
}

seed().catch(console.error);
