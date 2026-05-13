const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../data/farm.db');
const db = new sqlite3.Database(dbPath);

const initData = async () => {
  console.log('开始初始化数据...');

  const batches = [
    { id: uuidv4(), orchard_name: '阳光果园', fruit_type: '草莓', batch_code: 'BATCH-2024-STRAWBERRY-001', planned_date: '2026-05-20', estimated_yield: 500, remaining_yield: 500 },
    { id: uuidv4(), orchard_name: '丰收农场', fruit_type: '樱桃', batch_code: 'BATCH-2024-CHERRY-001', planned_date: '2026-06-10', estimated_yield: 200, remaining_yield: 200 },
    { id: uuidv4(), orchard_name: '绿色田园', fruit_type: '蓝莓', batch_code: 'BATCH-2024-BLUEBERRY-001', planned_date: '2026-07-01', estimated_yield: 300, remaining_yield: 300 },
    { id: uuidv4(), orchard_name: '有机农场', fruit_type: '葡萄', batch_code: 'BATCH-2024-GRAPE-001', planned_date: '2026-08-15', estimated_yield: 800, remaining_yield: 800 }
  ];

  for (const batch of batches) {
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO orchard_batches (id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield, unit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batch.id, batch.orchard_name, batch.fruit_type, batch.batch_code, batch.planned_date, batch.estimated_yield, batch.remaining_yield, 'kg', 'active'],
        resolve
      );
    });
    console.log(`创建批次: ${batch.batch_code}`);
  }

  const customers = [
    { name: '张三', phone: '13800138001' },
    { name: '李四', phone: '13800138002' },
    { name: '王五', phone: '13800138003' },
    { name: '赵六', phone: '13800138004' },
    { name: '钱七', phone: '13800138005' }
  ];

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const batch = batches[i % batches.length];
    const appointmentId = uuidv4();
    
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [appointmentId, batch.id, customer.name, customer.phone, 10 + i * 5, batch.planned_date, 'pending'],
        resolve
      );
    });
    console.log(`创建预约: ${customer.name}`);
  }

  const refundRules = [
    { id: uuidv4(), rule_name: '提前7天以上', days_before_appointment: 7, refund_rate: 1.0 },
    { id: uuidv4(), rule_name: '提前3-7天', days_before_appointment: 3, refund_rate: 0.8 },
    { id: uuidv4(), rule_name: '提前1-3天', days_before_appointment: 1, refund_rate: 0.5 }
  ];

  for (const rule of refundRules) {
    await new Promise((resolve) => {
      db.run(
        `INSERT INTO refund_rules (id, rule_name, days_before_appointment, refund_rate, is_active) VALUES (?, ?, ?, ?, ?)`,
        [rule.id, rule.rule_name, rule.days_before_appointment, rule.refund_rate, 1],
        resolve
      );
    });
    console.log(`创建退款规则: ${rule.rule_name}`);
  }

  console.log('数据初始化完成！');
  db.close();
};

initData().catch(console.error);
