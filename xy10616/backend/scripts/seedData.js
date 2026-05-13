const db = require('../config/database');
const moment = require('moment');

const seedData = async () => {
  console.log('开始生成样例数据...');

  const plateBindings = [
    { plate_number: '京A12345', card_number: 'CARD001', owner_name: '张三', phone: '13800138001', valid_from: '2024-01-01', valid_to: '2024-05-15', status: 'active' },
    { plate_number: '京B23456', card_number: 'CARD002', owner_name: '李四', phone: '13800138002', valid_from: '2024-02-01', valid_to: '2024-06-01', status: 'active' },
    { plate_number: '京C34567', card_number: 'CARD003', owner_name: '王五', phone: '13800138003', valid_from: '2024-01-15', valid_to: '2024-05-20', status: 'active' },
    { plate_number: '京D45678', card_number: 'CARD004', owner_name: '赵六', phone: '13800138004', valid_from: '2024-03-01', valid_to: '2024-04-30', status: 'active' },
    { plate_number: '京E56789', card_number: 'CARD005', owner_name: '钱七', phone: '13800138005', valid_from: '2024-02-15', valid_to: '2024-07-15', status: 'active' },
    { plate_number: '京F67890', card_number: 'CARD006', owner_name: '孙八', phone: '13800138006', valid_from: '2024-01-01', valid_to: '2024-12-31', status: 'active' },
    { plate_number: '京G78901', card_number: 'CARD007', owner_name: '周九', phone: '13800138007', valid_from: '2024-04-01', valid_to: '2024-05-05', status: 'active' },
    { plate_number: '京H89012', card_number: 'CARD008', owner_name: '吴十', phone: '13800138008', valid_from: '2024-03-15', valid_to: '2024-09-15', status: 'active' },
  ];

  for (const binding of plateBindings) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plate_bindings (plate_number, card_number, owner_name, phone, parking_type, valid_from, valid_to, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [binding.plate_number, binding.card_number, binding.owner_name, binding.phone, 'monthly', binding.valid_from, binding.valid_to, binding.status, new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  console.log('车牌绑定数据已生成');

  const arrearsData = [
    { plate_number: '京A12345', bill_month: '2024-04', amount: 300, status: 'unpaid' },
    { plate_number: '京B23456', bill_month: '2024-04', amount: 300, status: 'unpaid' },
    { plate_number: '京C34567', bill_month: '2024-03', amount: 300, status: 'unpaid' },
    { plate_number: '京D45678', bill_month: '2024-04', amount: 300, status: 'paid', paid_amount: 300, payment_method: 'wechat', handler: 'admin' },
    { plate_number: '京E56789', bill_month: '2024-04', amount: 300, status: 'unpaid' },
    { plate_number: '京G78901', bill_month: '2024-03', amount: 150, status: 'unpaid' },
    { plate_number: '京G78901', bill_month: '2024-04', amount: 300, status: 'unpaid' },
  ];

  for (const arrear of arrearsData) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO arrears_ledger (plate_number, bill_month, amount, paid_amount, status, payment_method, paid_at, handler, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [arrear.plate_number, arrear.bill_month, arrear.amount, arrear.paid_amount || 0, arrear.status, arrear.payment_method || null, arrear.paid_at || null, arrear.handler || null, new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  console.log('欠费账本数据已生成');

  const renewalData = [
    { plate_number: '京A12345', transaction_no: 'TXN001', amount: 300, payment_method: 'alipay', renewal_months: 1, new_valid_to: '2024-06-15', status: 'completed', handler: '操作员A' },
    { plate_number: '京B23456', transaction_no: 'TXN002', amount: 900, payment_method: 'wechat', renewal_months: 3, new_valid_to: '2024-09-01', status: 'completed', handler: '操作员A' },
    { plate_number: '京F67890', transaction_no: 'TXN003', amount: 600, payment_method: 'cash', renewal_months: 2, new_valid_to: '2025-02-28', status: 'completed', handler: '操作员B' },
    { plate_number: '京H89012', transaction_no: 'TXN004', amount: 300, payment_method: 'alipay', renewal_months: 1, new_valid_to: '2024-10-15', status: 'pending', handler: '操作员B' },
  ];

  for (const renewal of renewalData) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO renewal_payments (plate_number, transaction_no, amount, payment_method, payment_time, renewal_months, new_valid_to, status, handler, remarks, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [renewal.plate_number, renewal.transaction_no, renewal.amount, renewal.payment_method, new Date().toISOString(), renewal.renewal_months, renewal.new_valid_to, renewal.status, renewal.handler, '', new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  console.log('续费支付数据已生成');

  const blacklistData = [
    { plate_number: '京X99999', reason: '恶意逃费', status: 'active', created_by: 'admin' },
    { plate_number: '京Y88888', reason: '多次违规', status: 'active', created_by: 'admin' },
  ];

  for (const black of blacklistData) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO blacklist (plate_number, reason, status, created_by, reviewed_by, reviewed_at, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [black.plate_number, black.reason, black.status, black.created_by, null, null, new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  console.log('黑名单数据已生成');

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO flow_records (business_type, business_id, action, old_value, new_value, operator, remarks, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['plate_binding', 1, 'create', null, JSON.stringify({ plate_number: '京A12345', card_number: 'CARD001' }), 'system', '初始化数据', new Date().toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  console.log('流转记录数据已生成');

  console.log('所有样例数据生成完成！');
  process.exit(0);
};

seedData().catch(err => {
  console.error('生成样例数据失败:', err);
  process.exit(1);
});
