const { Customer, Vehicle, Material, Appointment } = require('./models');
const { db, generateId, now } = require('./database');
const dayjs = require('dayjs');

const seedData = {
  customers: [
    {
      name: '张三',
      phone: '13800138001',
      id_card: '110101198001010011',
      address: '北京市朝阳区建国路88号'
    },
    {
      name: '李四',
      phone: '13900139002',
      id_card: '110101198502020022',
      address: '北京市海淀区中关村大街1号'
    },
    {
      name: '王五',
      phone: '13700137003',
      id_card: '110101199003030033',
      address: '北京市西城区金融街5号'
    }
  ],
  vehicles: [
    {
      plate_number: '京A12345',
      brand: '大众',
      model: '朗逸',
      year: 2020,
      vin: 'LFV2A2153A1234567',
      engine_number: 'CST1234567'
    },
    {
      plate_number: '京B67890',
      brand: '丰田',
      model: '凯美瑞',
      year: 2018,
      vin: 'LVGBH42K1K1234567',
      engine_number: '6ZR1234567'
    },
    {
      plate_number: '京C11111',
      brand: '奔驰',
      model: 'E级',
      year: 2019,
      vin: 'WDDZF4JB1K1234567',
      engine_number: '2741234567'
    }
  ]
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkDataExists() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count > 0);
      }
    });
  });
}

async function init() {
  try {
    const exists = await checkDataExists();
    if (exists) {
      console.log('数据已存在，跳过初始化');
      return;
    }

    console.log('开始初始化样例数据...');
    
    const currentTime = now();
    
    const customer1 = await Customer.create(seedData.customers[0]);
    await wait(100);
    
    const customer2 = await Customer.create(seedData.customers[1]);
    await wait(100);
    
    const customer3 = await Customer.create(seedData.customers[2]);
    await wait(100);
    
    console.log('客户数据创建完成');
    
    const vehicle1 = await Vehicle.create({
      ...seedData.vehicles[0],
      customer_id: customer1.id
    }, '系统初始化', 'seed');
    await wait(100);
    
    const vehicle2 = await Vehicle.create({
      ...seedData.vehicles[1],
      customer_id: customer2.id
    }, '系统初始化', 'seed');
    await wait(100);
    
    const vehicle3 = await Vehicle.create({
      ...seedData.vehicles[2],
      customer_id: customer3.id
    }, '系统初始化', 'seed');
    await wait(100);
    
    console.log('车辆数据创建完成');
    
    await wait(200);
    
    const materials1 = await Material.findByVehicleId(vehicle1.id);
    for (const material of materials1) {
      await Material.collectMaterial(vehicle1.id, material.material_type, '系统初始化', 'seed');
      await wait(50);
    }
    await wait(100);
    
    await Vehicle.changeStatus(vehicle1.id, 'materials_collected', null, '系统初始化', 'seed');
    await wait(100);
    
    const appointment1 = await Appointment.create({
      vehicle_id: vehicle1.id,
      appointment_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
      appointment_time: '09:00',
      inspection_station: '北京市第一检测场'
    }, '系统初始化', 'seed');
    await wait(100);
    
    await Vehicle.changeStatus(vehicle1.id, 'appointment_scheduled', null, '系统初始化', 'seed');
    await wait(100);
    
    await Appointment.update(appointment1.id, {
      ...appointment1,
      status: 'passed',
      inspection_result: '通过'
    });
    await wait(100);
    
    await Vehicle.changeStatus(vehicle1.id, 'inspection_completed', null, '系统初始化', 'seed');
    await wait(100);
    
    await Vehicle.changeStatus(vehicle1.id, 'certificate_collected', null, '系统初始化', 'seed');
    await wait(100);
    
    console.log('案例1: 正常通过 - 已完成');
    
    const materials2 = await Material.findByVehicleId(vehicle2.id);
    for (const material of materials2) {
      if (material.material_type !== '交强险保单') {
        await Material.collectMaterial(vehicle2.id, material.material_type, '系统初始化', 'seed');
        await wait(50);
      }
    }
    await wait(100);
    
    console.log('案例2: 缺交强险 - 已完成');
    
    const materials3 = await Material.findByVehicleId(vehicle3.id);
    for (const material of materials3) {
      await Material.collectMaterial(vehicle3.id, material.material_type, '系统初始化', 'seed');
      await wait(50);
    }
    await wait(100);
    
    await Vehicle.changeStatus(vehicle3.id, 'materials_collected', null, '系统初始化', 'seed');
    await wait(100);
    
    const appointment3 = await Appointment.create({
      vehicle_id: vehicle3.id,
      appointment_date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
      appointment_time: '10:00',
      inspection_station: '北京市第二检测场'
    }, '系统初始化', 'seed');
    await wait(100);
    
    await Vehicle.changeStatus(vehicle3.id, 'appointment_scheduled', null, '系统初始化', 'seed');
    await wait(100);
    
    await Appointment.update(appointment3.id, {
      ...appointment3,
      status: 'failed',
      inspection_result: '未通过',
      failure_reason: '刹车系统不合格，需要维修后重检'
    });
    await wait(100);
    
    await Vehicle.changeStatus(vehicle3.id, 'inspection_failed', '刹车系统不合格，需要维修后重检', '系统初始化', 'seed');
    await wait(100);
    
    const appointment3Retry = await Appointment.create({
      vehicle_id: vehicle3.id,
      appointment_date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
      appointment_time: '14:00',
      inspection_station: '北京市第二检测场'
    }, '系统初始化', 'seed');
    await wait(100);
    
    await Vehicle.changeStatus(vehicle3.id, 'retest_scheduled', null, '系统初始化', 'seed');
    await wait(100);
    
    console.log('案例3: 检测失败后重约 - 已完成');
    
    console.log('所有样例数据初始化完成');
  } catch (error) {
    console.error('初始化样例数据失败:', error.message);
    console.error(error.stack);
  }
}

module.exports = { init };
