const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const seedData = () => {
  const devices = [
    { id: uuidv4(), device_number: 'DEV001', language_pack: '中文', status: 'available', battery_level: 95 },
    { id: uuidv4(), device_number: 'DEV002', language_pack: '英文', status: 'rented', battery_level: 60 },
    { id: uuidv4(), device_number: 'DEV003', language_pack: '日语', status: 'repairing', battery_level: 30 },
    { id: uuidv4(), device_number: 'DEV004', language_pack: '韩语', status: 'available', battery_level: 85 },
    { id: uuidv4(), device_number: 'DEV005', language_pack: '中文', status: 'rented', battery_level: 45 },
    { id: uuidv4(), device_number: 'DEV006', language_pack: '法语', status: 'available', battery_level: 100 },
    { id: uuidv4(), device_number: 'DEV007', language_pack: '德语', status: 'repairing', battery_level: 15 },
    { id: uuidv4(), device_number: 'DEV008', language_pack: '中文', status: 'available', battery_level: 70 },
  ];

  const orders = [
    {
      id: uuidv4(),
      device_id: devices[1].id,
      device_number: devices[1].device_number,
      customer_name: '张三',
      customer_phone: '13800138001',
      deposit_amount: 200,
      rental_time: '2024-01-15 09:30:00',
      status: 'active',
      operator: '李管理员'
    },
    {
      id: uuidv4(),
      device_id: devices[4].id,
      device_number: devices[4].device_number,
      customer_name: '李四',
      customer_phone: '13800138002',
      deposit_amount: 200,
      rental_time: '2024-01-15 10:15:00',
      status: 'active',
      operator: '李管理员'
    },
    {
      id: uuidv4(),
      device_id: devices[0].id,
      device_number: devices[0].device_number,
      customer_name: '王五',
      customer_phone: '13800138003',
      deposit_amount: 200,
      rental_time: '2024-01-14 14:00:00',
      return_time: '2024-01-14 17:30:00',
      status: 'completed',
      operator: '王管理员'
    },
  ];

  const repairRecords = [
    {
      id: uuidv4(),
      device_id: devices[2].id,
      device_number: devices[2].device_number,
      issue_description: '耳机接口损坏',
      repair_status: 'pending',
      responsible_person: '张维修',
      operator: '李管理员'
    },
    {
      id: uuidv4(),
      device_id: devices[6].id,
      device_number: devices[6].device_number,
      issue_description: '电池不充电',
      repair_status: 'in_progress',
      responsible_person: '李维修',
      operator: '王管理员'
    },
  ];

  const exceptions = [
    {
      id: uuidv4(),
      device_id: devices[1].id,
      device_number: devices[1].device_number,
      order_id: orders[0].id,
      exception_type: 'low_battery',
      description: '租借时电量低于50%，需要提醒',
      status: 'pending',
      responsible_person: '李管理员',
      operator: '系统'
    },
  ];

  db.serialize(() => {
    const stmtDevice = db.prepare('INSERT INTO devices VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
    devices.forEach(d => stmtDevice.run(d.id, d.device_number, d.language_pack, d.status, d.battery_level));
    stmtDevice.finalize();

    const stmtOrder = db.prepare('INSERT INTO rental_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
    orders.forEach(o => stmtOrder.run(o.id, o.device_id, o.device_number, o.customer_name, o.customer_phone, o.deposit_amount, o.rental_time, o.return_time, o.status, o.operator));
    stmtOrder.finalize();

    const stmtRepair = db.prepare('INSERT INTO repair_records VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
    repairRecords.forEach(r => stmtRepair.run(r.id, r.device_id, r.device_number, r.issue_description, r.repair_status, r.responsible_person, r.operator));
    stmtRepair.finalize();

    const stmtException = db.prepare('INSERT INTO exceptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
    exceptions.forEach(e => stmtException.run(e.id, e.device_id, e.device_number, e.order_id, e.exception_type, e.description, e.status, e.responsible_person, e.operator));
    stmtException.finalize();

    console.log('样例数据插入完成');
  });
};

seedData();
