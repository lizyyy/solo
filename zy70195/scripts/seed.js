const db = require('../src/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('开始初始化测试数据...');
  
  await db.init();
  const sqliteDb = db.getDb();
  
  console.log('清理旧数据...');
  await sqliteDb.run('DELETE FROM freeze_logs');
  await sqliteDb.run('DELETE FROM exception_records');
  await sqliteDb.run('DELETE FROM risk_list');
  await sqliteDb.run('DELETE FROM recovery_requests');
  await sqliteDb.run('DELETE FROM supplement_requests');
  await sqliteDb.run('DELETE FROM orders');
  await sqliteDb.run('DELETE FROM qualifications');
  await sqliteDb.run('DELETE FROM expiry_rules');
  await sqliteDb.run('DELETE FROM suppliers');
  
  console.log('创建到期规则...');
  const today = new Date();
  const rules = [
    {
      id: 'rule_default',
      qualification_type: '营业执照',
      warning_days: 90,
      freeze_days: 0,
      auto_trigger_supplement: 1,
      is_active: 1
    },
    {
      id: 'rule_license',
      qualification_type: '食品经营许可证',
      warning_days: 60,
      freeze_days: 0,
      auto_trigger_supplement: 1,
      is_active: 1
    },
    {
      id: 'rule_cert',
      qualification_type: '产品认证',
      warning_days: 30,
      freeze_days: 7,
      auto_trigger_supplement: 1,
      is_active: 1
    },
    {
      id: 'rule_other',
      qualification_type: '其他资质',
      warning_days: 30,
      freeze_days: 0,
      auto_trigger_supplement: 0,
      is_active: 1
    }
  ];
  
  for (const rule of rules) {
    await sqliteDb.run(`
      INSERT INTO expiry_rules (id, qualification_type, warning_days, freeze_days, auto_trigger_supplement, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [rule.id, rule.qualification_type, rule.warning_days, rule.freeze_days, rule.auto_trigger_supplement, rule.is_active]);
  }
  
  console.log('创建测试供应商...');
  const suppliers = [
    { id: 'sup_001', name: '北京顺达食品有限公司', status: 'active', contact: '张经理', phone: '13800138001' },
    { id: 'sup_002', name: '上海优选农产品有限公司', status: 'active', contact: '李总', phone: '13800138002' },
    { id: 'sup_003', name: '广州新鲜配送有限公司', status: 'active', contact: '王经理', phone: '13800138003' },
    { id: 'sup_004', name: '深圳健康食材有限公司', status: 'active', contact: '陈总', phone: '13800138004' },
    { id: 'sup_005', name: '杭州绿色农业发展有限公司', status: 'active', contact: '刘经理', phone: '13800138005' }
  ];
  
  for (const supplier of suppliers) {
    await sqliteDb.run(`
      INSERT INTO suppliers (id, name, status, contact, phone)
      VALUES (?, ?, ?, ?, ?)
    `, [supplier.id, supplier.name, supplier.status, supplier.contact, supplier.phone]);
  }
  
  console.log('创建资质档案...');
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  const qualifications = [
    {
      id: 'qual_001',
      supplier_id: 'sup_001',
      type: '营业执照',
      name: '营业执照正本',
      certificate_no: '91110105MA00123456',
      effective_date: formatDate(addDays(today, -365)),
      expiry_date: formatDate(addDays(today, 365)),
      status: 'active'
    },
    {
      id: 'qual_002',
      supplier_id: 'sup_001',
      type: '食品经营许可证',
      name: '食品经营许可证',
      certificate_no: 'SC10111010500001',
      effective_date: formatDate(addDays(today, -730)),
      expiry_date: formatDate(addDays(today, -10)),
      status: 'expired'
    },
    {
      id: 'qual_003',
      supplier_id: 'sup_002',
      type: '营业执照',
      name: '营业执照正本',
      certificate_no: '91310105MA00234567',
      effective_date: formatDate(addDays(today, -180)),
      expiry_date: formatDate(addDays(today, 365)),
      status: 'active'
    },
    {
      id: 'qual_004',
      supplier_id: 'sup_002',
      type: '产品认证',
      name: '有机产品认证',
      certificate_no: 'OGC-2024-001',
      effective_date: formatDate(addDays(today, -90)),
      expiry_date: formatDate(addDays(today, 20)),
      status: 'warning'
    },
    {
      id: 'qual_005',
      supplier_id: 'sup_003',
      type: '营业执照',
      name: '营业执照正本',
      certificate_no: '91440105MA00345678',
      effective_date: formatDate(addDays(today, -365)),
      expiry_date: formatDate(addDays(today, 180)),
      status: 'active'
    },
    {
      id: 'qual_006',
      supplier_id: 'sup_003',
      type: '食品经营许可证',
      name: '食品经营许可证',
      certificate_no: 'SC10144010500002',
      effective_date: formatDate(addDays(today, -365)),
      expiry_date: formatDate(addDays(today, 45)),
      status: 'warning'
    },
    {
      id: 'qual_007',
      supplier_id: 'sup_004',
      type: '营业执照',
      name: '营业执照正本',
      certificate_no: '91440305MA00456789',
      effective_date: formatDate(addDays(today, -730)),
      expiry_date: formatDate(addDays(today, 730)),
      status: 'active'
    },
    {
      id: 'qual_008',
      supplier_id: 'sup_004',
      type: '食品经营许可证',
      name: '食品经营许可证',
      certificate_no: 'SC10144030500003',
      effective_date: formatDate(addDays(today, -180)),
      expiry_date: formatDate(addDays(today, 545)),
      status: 'active'
    },
    {
      id: 'qual_009',
      supplier_id: 'sup_005',
      type: '营业执照',
      name: '营业执照正本',
      certificate_no: '91330105MA00567890',
      effective_date: formatDate(addDays(today, -365)),
      expiry_date: formatDate(addDays(today, 365)),
      status: 'active'
    },
    {
      id: 'qual_010',
      supplier_id: 'sup_005',
      type: '其他资质',
      name: '绿色食品认证',
      certificate_no: 'GF-2024-001',
      effective_date: formatDate(addDays(today, -180)),
      expiry_date: formatDate(addDays(today, 15)),
      status: 'warning'
    }
  ];
  
  for (const qual of qualifications) {
    await sqliteDb.run(`
      INSERT INTO qualifications (id, supplier_id, type, name, certificate_no, effective_date, expiry_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [qual.id, qual.supplier_id, qual.type, qual.name, qual.certificate_no, qual.effective_date, qual.expiry_date, qual.status]);
  }
  
  console.log('创建测试订单...');
  const orders = [
    {
      id: 'order_001',
      order_no: 'ORD-2024-0001',
      supplier_id: 'sup_004',
      amount: 25000,
      status: 'completed',
      freeze_reason: null
    },
    {
      id: 'order_002',
      order_no: 'ORD-2024-0002',
      supplier_id: 'sup_004',
      amount: 18500,
      status: 'approved',
      freeze_reason: null
    },
    {
      id: 'order_003',
      order_no: 'ORD-2024-0003',
      supplier_id: 'sup_003',
      amount: 32000,
      status: 'pending',
      freeze_reason: null
    },
    {
      id: 'order_004',
      order_no: 'ORD-2024-0004',
      supplier_id: 'sup_001',
      amount: 5000,
      status: 'blocked',
      freeze_reason: '供应商资质过期: 食品经营许可证'
    }
  ];
  
  for (const order of orders) {
    await sqliteDb.run(`
      INSERT INTO orders (id, order_no, supplier_id, amount, status, freeze_reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [order.id, order.order_no, order.supplier_id, order.amount, order.status, order.freeze_reason]);
  }
  
  console.log('冻结过期资质的供应商...');
  await sqliteDb.run(`
    UPDATE suppliers 
    SET status = 'frozen'
    WHERE id IN (
      SELECT q.supplier_id 
      FROM qualifications q
      WHERE q.status = 'expired'
    )
  `);
  
  const frozenSuppliers = await sqliteDb.all(`
    SELECT s.id, s.name, q.id as qualification_id, q.name as qual_name, q.expiry_date
    FROM suppliers s
    JOIN qualifications q ON s.id = q.supplier_id
    WHERE s.status = 'frozen' AND q.status = 'expired'
  `);
  
  for (const sup of frozenSuppliers) {
    const logId = 'log_' + uuidv4().substring(0, 8);
    await sqliteDb.run(`
      INSERT INTO freeze_logs (id, supplier_id, action, reason, qualification_id)
      VALUES (?, ?, 'freeze', '资质过期自动冻结', ?)
    `, [logId, sup.id, sup.qualification_id]);
  }
  
  console.log('');
  console.log('测试数据初始化完成！');
  console.log('');
  console.log('创建的测试数据:');
  console.log('  - 到期规则: 4 条');
  console.log('  - 供应商: 5 家');
  console.log('  - 资质档案: 10 条');
  console.log('  - 测试订单: 4 条');
  console.log('');
  console.log('测试场景说明:');
  console.log('  - sup_001 (北京顺达食品): 食品经营许可证已过期，供应商已被冻结');
  console.log('  - sup_002 (上海优选农产品): 有机产品认证20天后到期（警告期）');
  console.log('  - sup_003 (广州新鲜配送): 食品经营许可证45天后到期（警告期）');
  console.log('  - sup_004 (深圳健康食材): 所有资质正常，可正常下单');
  console.log('  - sup_005 (杭州绿色农业): 绿色食品认证15天后到期（警告期）');
  console.log('');
  console.log('可运行 npm run test-flow 测试主流程');
  console.log('可运行 npm start 启动服务');
  
  process.exit(0);
}

seed().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
