const { v4: uuidv4 } = require('uuid');
const { initDatabase, runQuery, getQuery } = require('../database');

const sampleLeads = [
  {
    name: '张三',
    phone: '13800138001',
    email: 'zhangsan@example.com',
    company: '科技有限公司',
    source: 'crm',
    source_id: 'crm_001'
  },
  {
    name: '李四',
    phone: '13900139002',
    email: 'lisi@example.com',
    company: '网络科技公司',
    source: 'website',
    source_id: 'web_001'
  },
  {
    name: '王五',
    phone: '13700137003',
    email: 'wangwu@example.com',
    company: '数据服务公司',
    source: 'event',
    source_id: 'event_001'
  },
  {
    name: '赵六',
    phone: '13600136004',
    email: 'zhaoliu@example.com',
    company: '云计算公司',
    source: 'crm',
    source_id: 'crm_002'
  },
  {
    name: '钱七',
    phone: '13500135005',
    email: 'qianqi@example.com',
    company: '智能科技公司',
    source: 'website',
    source_id: 'web_002'
  }
];

async function seedDatabase() {
  console.log('开始填充数据库...');
  
  await initDatabase();

  for (const lead of sampleLeads) {
    const leadId = uuidv4();
    const requestId = uuidv4();
    
    await runQuery(
      `INSERT INTO leads (id, request_id, name, phone, email, company, source, source_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [leadId, requestId, lead.name, lead.phone, lead.email, lead.company, lead.source, lead.source_id, 'accepted']
    );

    const logId = uuidv4();
    await runQuery(
      `INSERT INTO processing_logs (id, lead_id, action, status, details, operator)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, leadId, 'seed_data', 'accepted', '初始化数据填充', 'system']
    );

    console.log(`已添加: ${lead.name}`);
  }

  console.log('\n数据库填充完成!');
  console.log(`共添加 ${sampleLeads.length} 条示例数据`);
}

seedDatabase().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('填充失败:', err);
  process.exit(1);
});
