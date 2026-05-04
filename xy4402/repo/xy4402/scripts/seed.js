const { sequelize, syncDatabase, Store, Vehicle, Batch } = require('../src/models');
const moment = require('moment');

const seedData = async () => {
  console.log('开始初始化数据库...');
  
  await syncDatabase(true);
  
  console.log('创建门店数据...');
  
  const stores = await Store.bulkCreate([
    {
      name: '川味轩火锅店',
      code: 'ST001',
      address: '北京市朝阳区建国路88号',
      latitude: 39.9042,
      longitude: 116.4074,
      contact: '张经理',
      phone: '13800138001',
      contractStartDate: new Date('2024-01-01'),
      contractEndDate: new Date('2025-12-31'),
      status: 'active'
    },
    {
      name: '湘菜馆',
      code: 'ST002',
      address: '北京市海淀区中关村大街100号',
      latitude: 39.9842,
      longitude: 116.3074,
      contact: '李老板',
      phone: '13800138002',
      contractStartDate: new Date('2024-01-01'),
      contractEndDate: new Date('2025-12-31'),
      status: 'active'
    },
    {
      name: '粤式茶餐厅',
      code: 'ST003',
      address: '北京市西城区西单北大街150号',
      latitude: 39.9142,
      longitude: 116.3774,
      contact: '王厨师长',
      phone: '13800138003',
      contractStartDate: new Date('2024-06-01'),
      contractEndDate: new Date('2025-05-31'),
      status: 'active'
    },
    {
      name: '老北京炸酱面',
      code: 'ST004',
      address: '北京市东城区王府井大街200号',
      latitude: 39.9182,
      longitude: 116.4154,
      contact: '赵店长',
      phone: '13800138004',
      contractStartDate: new Date('2023-01-01'),
      contractEndDate: new Date('2023-12-31'),
      status: 'inactive'
    },
    {
      name: '重庆小面',
      code: 'ST005',
      address: '北京市丰台区丰台路66号',
      latitude: 39.8642,
      longitude: 116.2874,
      contact: '陈老板',
      phone: '13800138005',
      contractStartDate: new Date('2024-03-01'),
      contractEndDate: new Date('2025-02-28'),
      status: 'suspended'
    }
  ]);
  
  console.log(`创建了 ${stores.length} 个门店`);
  
  console.log('创建车辆数据...');
  
  const vehicles = await Vehicle.bulkCreate([
    {
      plateNumber: '京A12345',
      type: '油罐车',
      capacity: 5.0,
      driverName: '张三',
      driverPhone: '13900139001',
      status: 'active'
    },
    {
      plateNumber: '京B67890',
      type: '油罐车',
      capacity: 8.0,
      driverName: '李四',
      driverPhone: '13900139002',
      status: 'active'
    },
    {
      plateNumber: '京C11111',
      type: '小型货车',
      capacity: 2.0,
      driverName: '王五',
      driverPhone: '13900139003',
      status: 'active'
    },
    {
      plateNumber: '京D22222',
      type: '油罐车',
      capacity: 10.0,
      driverName: '赵六',
      driverPhone: '13900139004',
      status: 'maintenance'
    }
  ]);
  
  console.log(`创建了 ${vehicles.length} 辆车`);
  
  console.log('创建示例批次...');
  
  const today = moment().format('YYYY-MM-DD');
  
  const batch = await Batch.create({
    batchNumber: `B${moment().format('YYYYMMDD')}-DEMO`,
    date: today,
    vehicleId: vehicles[0].id,
    status: 'pending',
    riskLevel: 'low',
    hasRisks: false
  });
  
  console.log(`创建了示例批次: ${batch.batchNumber}`);
  
  console.log('');
  console.log('='.repeat(50));
  console.log('Seed 数据初始化完成！');
  console.log('='.repeat(50));
  console.log('');
  console.log('门店数据:');
  stores.forEach(store => {
    console.log(`  - ${store.name} (${store.code}) - ${store.status}`);
  });
  console.log('');
  console.log('车辆数据:');
  vehicles.forEach(vehicle => {
    console.log(`  - ${vehicle.plateNumber} - ${vehicle.driverName} - ${vehicle.status}`);
  });
  console.log('');
  console.log('示例批次:');
  console.log(`  - ${batch.batchNumber}`);
  console.log('');
  console.log('使用说明:');
  console.log('  1. 运行 npm start 启动服务');
  console.log('  2. 访问 http://localhost:3000/ 查看 API 信息');
  console.log('  3. 使用示例数据文件测试文件上传');
  console.log('');
  
  await sequelize.close();
};

seedData().catch(error => {
  console.error('Seed 数据初始化失败:', error);
  process.exit(1);
});
