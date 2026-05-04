const path = require('path');

const dbDir = path.join(__dirname, '../data');
const fs = require('fs');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const { initDatabase } = require('../src/config/schema');
const db = require('../src/config/database');

function seedDatabase() {
  console.log('开始初始化数据库...');
  initDatabase();
  
  console.log('清空现有数据...');
  db.prepare('DELETE FROM booking_status_logs').run();
  db.prepare('DELETE FROM shift_transactions').run();
  db.prepare('DELETE FROM shifts').run();
  db.prepare('DELETE FROM damage_records').run();
  db.prepare('DELETE FROM deposit_transactions').run();
  db.prepare('DELETE FROM booking_devices').run();
  db.prepare('DELETE FROM bookings').run();
  db.prepare('DELETE FROM customers').run();
  db.prepare('DELETE FROM devices').run();
  db.prepare('DELETE FROM rooms').run();
  
  console.log('插入房间数据...');
  const rooms = [
    { name: 'A房 - 大排练室', type: 'rehearsal', capacity: 8, baseRatePerHour: 150, equipment: '鼓组、贝斯箱、吉他箱、PA系统', status: 'active' },
    { name: 'B房 - 中排练室', type: 'rehearsal', capacity: 5, baseRatePerHour: 100, equipment: '小型鼓组、贝斯箱、吉他箱', status: 'active' },
    { name: 'C房 - 小排练室', type: 'rehearsal', capacity: 3, baseRatePerHour: 60, equipment: '吉他箱、小PA', status: 'active' },
    { name: '录音棚', type: 'recording', capacity: 4, baseRatePerHour: 300, equipment: '专业录音设备、监听系统', status: 'active' }
  ];
  
  const insertRoomStmt = db.prepare(`
    INSERT INTO rooms (name, type, capacity, base_rate_per_hour, equipment, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  rooms.forEach(room => {
    insertRoomStmt.run(room.name, room.type, room.capacity, room.baseRatePerHour, room.equipment, room.status);
  });
  
  console.log('插入设备数据...');
  const devices = [
    { name: 'Shure SM58 话筒', category: 'microphone', model: 'SM58', serialNumber: 'MIC001', rentalRatePerHour: 20, depositRequired: 500, status: 'available', condition: 'good' },
    { name: 'Shure SM58 话筒', category: 'microphone', model: 'SM58', serialNumber: 'MIC002', rentalRatePerHour: 20, depositRequired: 500, status: 'available', condition: 'good' },
    { name: 'Shure SM58 话筒', category: 'microphone', model: 'SM58', serialNumber: 'MIC003', rentalRatePerHour: 20, depositRequired: 500, status: 'available', condition: 'good' },
    { name: 'AKG D112 底鼓麦', category: 'microphone', model: 'D112', serialNumber: 'MIC004', rentalRatePerHour: 30, depositRequired: 800, status: 'available', condition: 'good' },
    { name: 'Boss GT-10 效果器', category: 'effects', model: 'GT-10', serialNumber: 'FX001', rentalRatePerHour: 15, depositRequired: 300, status: 'available', condition: 'good' },
    { name: 'Line 6 Pod HD500', category: 'effects', model: 'HD500', serialNumber: 'FX002', rentalRatePerHour: 15, depositRequired: 400, status: 'available', condition: 'good' },
    { name: 'Hercules 键盘架', category: 'stand', model: 'KS410B', serialNumber: 'STAND001', rentalRatePerHour: 5, depositRequired: 100, status: 'available', condition: 'good' },
    { name: 'Hercules 键盘架', category: 'stand', model: 'KS410B', serialNumber: 'STAND002', rentalRatePerHour: 5, depositRequired: 100, status: 'available', condition: 'good' },
    { name: '吉他单块效果器板', category: 'effects', model: 'Pedalboard', serialNumber: 'FX003', rentalRatePerHour: 10, depositRequired: 200, status: 'available', condition: 'good', notes: '含电源、连接线' },
    { name: 'DI盒', category: 'accessory', model: 'Radial J48', serialNumber: 'ACC001', rentalRatePerHour: 10, depositRequired: 150, status: 'available', condition: 'good' },
    { name: '耳机分配器', category: 'accessory', model: 'Behringer HA400', serialNumber: 'ACC002', rentalRatePerHour: 8, depositRequired: 100, status: 'available', condition: 'good' },
    { name: '落地式话筒架', category: 'stand', model: 'Hercules MS533B', serialNumber: 'STAND003', rentalRatePerHour: 8, depositRequired: 150, status: 'available', condition: 'good' },
    { name: '落地式话筒架', category: 'stand', model: 'Hercules MS533B', serialNumber: 'STAND004', rentalRatePerHour: 8, depositRequired: 150, status: 'available', condition: 'good' }
  ];
  
  const insertDeviceStmt = db.prepare(`
    INSERT INTO devices (name, category, model, serial_number, rental_rate_per_hour, deposit_required, status, condition, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  devices.forEach(device => {
    insertDeviceStmt.run(device.name, device.category, device.model, device.serialNumber, device.rentalRatePerHour, device.depositRequired, device.status, device.condition, device.notes || null);
  });
  
  console.log('插入客户数据...');
  const customers = [
    { name: '张三', phone: '13800138001', email: 'zhangsan@example.com', notes: '摇滚乐队主唱，常来A房' },
    { name: '李四', phone: '13800138002', email: 'lisi@example.com', notes: '独立音乐人，常用B房' },
    { name: '王五乐队', phone: '13800138003', email: 'wangwuband@example.com', notes: '4人乐队，固定每周三排练' },
    { name: '赵六', phone: '13800138004', email: 'zhaoliu@example.com', notes: '录音客户，需要专业设备' },
    { name: '新声乐队', phone: '13800138005', email: 'xsband@example.com', notes: '新人乐队，刚开始排练' }
  ];
  
  const insertCustomerStmt = db.prepare(`
    INSERT INTO customers (name, phone, email, notes)
    VALUES (?, ?, ?, ?)
  `);
  
  customers.forEach(customer => {
    insertCustomerStmt.run(customer.name, customer.phone, customer.email, customer.notes);
  });
  
  console.log('插入种子数据完成！');
  
  const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
  const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  
  console.log('\n数据统计:');
  console.log(`  - 房间: ${roomCount} 间`);
  console.log(`  - 设备: ${deviceCount} 件`);
  console.log(`  - 客户: ${customerCount} 位`);
  
  console.log('\n种子数据初始化完成！');
}

seedDatabase();
