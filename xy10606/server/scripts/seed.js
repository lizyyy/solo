const { run, initSchema } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

async function seedDatabase() {
  console.log('开始初始化数据库和样例数据...');
  await initSchema();
  console.log('数据库结构初始化完成');
  
  console.log('开始初始化样例数据...');
  
  const hosts = [
    { id: uuidv4(), name: '张主播', department: '美妆部' },
    { id: uuidv4(), name: '李主播', department: '服饰部' },
    { id: uuidv4(), name: '王主播', department: '食品部' }
  ];
  
  const insertHost = 'INSERT INTO hosts (id, name, department) VALUES (?, ?, ?)';
  for (const host of hosts) {
    await run(insertHost, [host.id, host.name, host.department]);
    console.log(`✓ 新增主播: ${host.name}`);
  }
  
  const today = new Date();
  const schedules = [
    {
      id: uuidv4(),
      host_id: hosts[0].id,
      schedule_date: new Date(today.getTime() - 86400000 * 3).toISOString().split('T')[0],
      start_time: '19:00',
      end_time: '22:00',
      description: '618美妆专场',
      status: 'completed'
    },
    {
      id: uuidv4(),
      host_id: hosts[1].id,
      schedule_date: new Date(today.getTime() - 86400000 * 1).toISOString().split('T')[0],
      start_time: '20:00',
      end_time: '23:00',
      description: '夏季女装上新',
      status: 'active'
    },
    {
      id: uuidv4(),
      host_id: hosts[2].id,
      schedule_date: new Date(today.getTime() + 86400000 * 2).toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '21:00',
      description: '零食大礼包专场',
      status: 'active'
    }
  ];
  
  const insertSchedule = `
    INSERT INTO host_schedules (id, host_id, schedule_date, start_time, end_time, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  for (const schedule of schedules) {
    await run(insertSchedule, [
      schedule.id,
      schedule.host_id,
      schedule.schedule_date,
      schedule.start_time,
      schedule.end_time,
      schedule.description,
      schedule.status
    ]);
    console.log(`✓ 新增排期: ${schedule.description} (${schedule.schedule_date})`);
  }
  
  const samples = [
    { id: uuidv4(), sku: 'SKU-001', name: '保湿精华液', category: '护肤品', unit_cost: 99.00, quantity_in_stock: 50 },
    { id: uuidv4(), sku: 'SKU-002', name: '口红套装', category: '化妆品', unit_cost: 199.00, quantity_in_stock: 30 },
    { id: uuidv4(), sku: 'SKU-003', name: '夏季连衣裙', category: '女装', unit_cost: 159.00, quantity_in_stock: 20 },
    { id: uuidv4(), sku: 'SKU-004', name: '短袖T恤', category: '男装', unit_cost: 79.00, quantity_in_stock: 3 },
    { id: uuidv4(), sku: 'SKU-005', name: '坚果礼盒', category: '食品', unit_cost: 128.00, quantity_in_stock: 100 },
    { id: uuidv4(), sku: 'SKU-006', name: '进口饼干', category: '食品', unit_cost: 39.90, quantity_in_stock: 200 }
  ];
  
  const insertSample = `
    INSERT INTO samples (id, sku, name, category, unit_cost, quantity_in_stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  for (const sample of samples) {
    await run(insertSample, [
      sample.id,
      sample.sku,
      sample.name,
      sample.category,
      sample.unit_cost,
      sample.quantity_in_stock
    ]);
    console.log(`✓ 新增样品: ${sample.name} (${sample.sku})`);
  }
  
  const responsiblePersons = [
    { id: uuidv4(), name: '仓库管理员A', role: '仓库管理员' },
    { id: uuidv4(), name: '运营经理B', role: '运营经理' },
    { id: uuidv4(), name: '财务主管C', role: '财务主管' }
  ];
  
  const insertResponsiblePerson = 'INSERT INTO responsible_persons (id, name, role) VALUES (?, ?, ?)';
  for (const person of responsiblePersons) {
    await run(insertResponsiblePerson, [person.id, person.name, person.role]);
    console.log(`✓ 新增责任人: ${person.name}`);
  }
  
  const transactions = [
    {
      id: uuidv4(),
      transaction_type: 'borrow',
      sample_id: samples[0].id,
      schedule_id: schedules[0].id,
      host_id: hosts[0].id,
      quantity: 5,
      responsible_person_id: responsiblePersons[0].id,
      status: 'approved',
      created_by: '系统',
      reviewed_by: '管理员',
      reviewed_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      transaction_type: 'borrow',
      sample_id: samples[1].id,
      schedule_id: schedules[0].id,
      host_id: hosts[0].id,
      quantity: 3,
      responsible_person_id: responsiblePersons[0].id,
      status: 'approved',
      created_by: '系统',
      reviewed_by: '管理员',
      reviewed_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      transaction_type: 'return',
      sample_id: samples[0].id,
      schedule_id: schedules[0].id,
      host_id: hosts[0].id,
      quantity: 3,
      loss_description: '样品拆封展示，包装有轻微磨损',
      responsible_person_id: responsiblePersons[0].id,
      status: 'pending',
      created_by: '系统'
    },
    {
      id: uuidv4(),
      transaction_type: 'sell',
      sample_id: samples[1].id,
      schedule_id: schedules[0].id,
      host_id: hosts[0].id,
      quantity: 2,
      responsible_person_id: responsiblePersons[2].id,
      status: 'pending',
      created_by: '系统'
    },
    {
      id: uuidv4(),
      transaction_type: 'borrow',
      sample_id: samples[2].id,
      schedule_id: schedules[1].id,
      host_id: hosts[1].id,
      quantity: 10,
      responsible_person_id: responsiblePersons[1].id,
      status: 'pending',
      created_by: '系统'
    },
    {
      id: uuidv4(),
      transaction_type: 'loss',
      sample_id: samples[4].id,
      schedule_id: schedules[2].id,
      host_id: hosts[2].id,
      quantity: 5,
      loss_description: '直播过程中意外损坏',
      responsible_person_id: responsiblePersons[1].id,
      status: 'rejected',
      created_by: '系统',
      reviewed_by: '管理员',
      reviewed_at: new Date().toISOString()
    }
  ];
  
  const insertTransaction = `
    INSERT INTO sample_transactions 
    (id, transaction_type, sample_id, schedule_id, host_id, quantity, loss_description, 
     status, responsible_person_id, created_by, reviewed_by, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const insertSubmittedTransaction = `
    INSERT INTO submitted_transactions (id, sample_id, schedule_id, transaction_type)
    VALUES (?, ?, ?, ?)
  `;
  
  const typeNames = {
    borrow: '借出',
    return: '归还',
    sell: '销售转正',
    loss: '损耗'
  };
  
  for (const transaction of transactions) {
    await run(insertTransaction, [
      transaction.id,
      transaction.transaction_type,
      transaction.sample_id,
      transaction.schedule_id,
      transaction.host_id,
      transaction.quantity,
      transaction.loss_description || null,
      transaction.status,
      transaction.responsible_person_id,
      transaction.created_by,
      transaction.reviewed_by || null,
      transaction.reviewed_at || null
    ]);
    
    await run(insertSubmittedTransaction, [
      uuidv4(),
      transaction.sample_id,
      transaction.schedule_id,
      transaction.transaction_type
    ]);
    
    const sample = samples.find(s => s.id === transaction.sample_id);
    console.log(`✓ 新增交易记录: ${typeNames[transaction.transaction_type]} - ${sample?.name} x ${transaction.quantity}`);
  }
  
  const samplesAfterUpdate = samples.filter(s => 
    transactions.some(t => t.sample_id === s.id && t.status === 'approved' && t.transaction_type === 'borrow')
  );
  
  const updateStock = 'UPDATE samples SET quantity_in_stock = ? WHERE id = ?';
  for (const sample of samplesAfterUpdate) {
    const borrowedQty = transactions
      .filter(t => t.sample_id === sample.id && t.status === 'approved' && t.transaction_type === 'borrow')
      .reduce((sum, t) => sum + t.quantity, 0);
    
    const newStock = sample.quantity_in_stock - borrowedQty;
    await run(updateStock, [newStock, sample.id]);
  }
  
  console.log('\n样例数据初始化完成！');
  console.log(`
已创建数据:
- 主播: ${hosts.length} 人
- 排期: ${schedules.length} 条
- 样品: ${samples.length} 个
- 责任人: ${responsiblePersons.length} 人
- 交易记录: ${transactions.length} 条
  `);
}

seedDatabase().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
