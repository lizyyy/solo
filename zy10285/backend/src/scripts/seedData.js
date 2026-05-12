const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const now = dayjs().format();

function seedData() {
  const customers = [
    { id: uuidv4(), name: '张记海鲜大排档', phone: '13800138001', address: '朝阳区海鲜街88号', balance: 0 },
    { id: uuidv4(), name: '王总酒吧', phone: '13800138002', address: '海淀区酒吧一条街12号', balance: 500 },
    { id: uuidv4(), name: '李记烧烤城', phone: '13800138003', address: '丰台区烧烤大道66号', balance: -200 },
    { id: uuidv4(), name: '陈记火锅店', phone: '13800138004', address: '西城区火锅街99号', balance: 0 },
    { id: uuidv4(), name: '赵总KTV', phone: '13800138005', address: '东城区娱乐广场5层', balance: 1000 },
  ];

  const iceSpecs = [
    { id: uuidv4(), name: '标准桶装冰', weight: 10, price: 25, description: '10公斤标准桶装冰块' },
    { id: uuidv4(), name: '食用级桶装冰', weight: 10, price: 35, description: '10公斤食品级纯净冰块' },
    { id: uuidv4(), name: '超大桶装冰', weight: 20, price: 45, description: '20公斤大容量桶装冰' },
    { id: uuidv4(), name: '碎冰桶装', weight: 10, price: 30, description: '10公斤预制碎冰' },
  ];

  const today = dayjs();
  const deliverySlots = [];
  for (let i = 0; i < 7; i++) {
    const date = today.add(i, 'day').format('YYYY-MM-DD');
    deliverySlots.push(
      { id: uuidv4(), date, start_time: '08:00', end_time: '10:00', max_capacity: 500, current_load: 450 },
      { id: uuidv4(), date, start_time: '10:00', end_time: '12:00', max_capacity: 500, current_load: 380 },
      { id: uuidv4(), date, start_time: '14:00', end_time: '16:00', max_capacity: 500, current_load: 520 },
      { id: uuidv4(), date, start_time: '16:00', end_time: '18:00', max_capacity: 500, current_load: 200 },
    );
  }

  const coolers = [];
  for (let i = 1; i <= 20; i++) {
    coolers.push({
      id: uuidv4(),
      serial_number: `COOLER-${String(i).padStart(3, '0')}`,
      status: i <= 5 ? 'in_use' : 'available',
      customer_id: i <= 5 ? customers[i - 1].id : null,
      assigned_at: i <= 5 ? now : null,
    });
  }

  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (id, name, phone, address, balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIceSpec = db.prepare(`
    INSERT OR IGNORE INTO ice_specs (id, name, weight, price, description, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertSlot = db.prepare(`
    INSERT OR IGNORE INTO delivery_slots (id, date, start_time, end_time, max_capacity, current_load, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const insertCooler = db.prepare(`
    INSERT OR IGNORE INTO coolers (id, serial_number, status, customer_id, assigned_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    customers.forEach(c => insertCustomer.run(c.id, c.name, c.phone, c.address, c.balance, now, now));
    iceSpecs.forEach(s => insertIceSpec.run(s.id, s.name, s.weight, s.price, s.description, now, now));
    deliverySlots.forEach(s => insertSlot.run(s.id, s.date, s.start_time, s.end_time, s.max_capacity, s.current_load, now, now));
    coolers.forEach(c => insertCooler.run(c.id, c.serial_number, c.status, c.customer_id, c.assigned_at, now, now));
  });

  transaction();
  console.log('样例数据插入完成！');
}

seedData();
