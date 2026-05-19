const db = require('../config/database');

const sampleUsers = [
  { name: '张三', role: 'agent' },
  { name: '李四', role: 'agent' },
  { name: '王组长', role: 'supervisor' }
];

const sampleCalls = [
  {
    call_id: 'CALL_001',
    agent_name: '张三',
    transcript: '客户反映商品质量有问题，非常不满意。客服表示抱歉并承诺全额退款。客户情绪有所缓和。',
    call_time: '2024-01-15 09:30:00',
    duration: 180,
    customer_phone: '13800138001'
  },
  {
    call_id: 'CALL_002',
    agent_name: '李四',
    transcript: '客户咨询订单物流情况。客服查询后告知预计明天送达。客户表示感谢。',
    call_time: '2024-01-15 10:15:00',
    duration: 90,
    customer_phone: '13800138002'
  },
  {
    call_id: 'CALL_003',
    agent_name: '张三',
    transcript: '客户投诉收到的商品有破损。客服这是什么垃圾服务，你他妈能不能解决问题？我再也不买了！',
    call_time: '2024-01-15 11:00:00',
    duration: 240,
    customer_phone: '13800138003'
  },
  {
    call_id: 'CALL_004',
    agent_name: '李四',
    transcript: '客户要求退货。客服询问退货原因后同意退货，并告知退货流程。未提及道歉或退款。',
    call_time: '2024-01-15 14:30:00',
    duration: 150,
    customer_phone: '13800138004'
  },
  {
    call_id: 'CALL_005',
    agent_name: '张三',
    transcript: '对不起给您带来了不好的体验。我们这边马上给您安排全额退款，您看可以吗？好的，非常抱歉。',
    call_time: '2024-01-16 09:00:00',
    duration: 120,
    customer_phone: '13800138005'
  }
];

function createUser(user) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (name, role) VALUES (?, ?)`,
      [user.name, user.role],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...user });
      }
    );
  });
}

function getUserByName(name) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE name = ?`, [name], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function createCall(call) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO calls (call_id, agent_id, transcript, call_time, duration, customer_phone) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [call.call_id, call.agent_id, call.transcript, call.call_time, call.duration, call.customer_phone],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...call });
      }
    );
  });
}

function createInspection(inspection) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO inspection_results 
       (call_id, has_apology, has_refund_promise, has_sensitive_word, sensitive_words, summary, anomaly_types) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [inspection.call_id, inspection.has_apology, inspection.has_refund_promise, 
       inspection.has_sensitive_word, inspection.sensitive_words, inspection.summary, inspection.anomaly_types],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...inspection });
      }
    );
  });
}

function detectApology(text) {
  const keywords = ['抱歉', '对不起', '不好意思', '道歉', '致歉', '深表歉意', 'sorry'];
  return keywords.some(k => text.includes(k));
}

function detectRefund(text) {
  const keywords = ['退款', '退钱', '退费', '全额退款', '部分退款', 'refund'];
  return keywords.some(k => text.includes(k));
}

function detectSensitive(text) {
  const keywords = ['傻逼', '操你妈', '滚蛋', '去死', '垃圾', '废物', 'fuck', 'shit'];
  return keywords.filter(k => text.includes(k));
}

async function seedData() {
  console.log('开始导入示例数据...');

  for (const user of sampleUsers) {
    const existing = await getUserByName(user.name);
    if (!existing) {
      await createUser(user);
      console.log(`创建用户: ${user.name}`);
    }
  }

  for (const call of sampleCalls) {
    const agent = await getUserByName(call.agent_name);
    call.agent_id = agent.id;
    
    const createdCall = await createCall(call);
    console.log(`创建通话: ${call.call_id}`);

    const hasApology = detectApology(call.transcript);
    const hasRefund = detectRefund(call.transcript);
    const sensitive = detectSensitive(call.transcript);
    
    const issues = [];
    if (!hasApology) issues.push('缺少道歉');
    if (!hasRefund) issues.push('缺少退款承诺');
    if (sensitive.length > 0) issues.push('包含敏感词');
    
    const summary = issues.length === 0 
      ? '通话记录正常' 
      : `检测到问题: ${issues.join('、')}`;
    
    const anomalyTypes = [];
    if (!hasApology) anomalyTypes.push('missing_apology');
    if (!hasRefund) anomalyTypes.push('missing_refund_promise');
    if (sensitive.length > 0) anomalyTypes.push('sensitive_word');

    await createInspection({
      call_id: createdCall.id,
      has_apology: hasApology ? 1 : 0,
      has_refund_promise: hasRefund ? 1 : 0,
      has_sensitive_word: sensitive.length > 0 ? 1 : 0,
      sensitive_words: JSON.stringify(sensitive),
      summary: summary,
      anomaly_types: JSON.stringify(anomalyTypes)
    });
    console.log(`  质检结果: 道歉=${hasApology}, 退款=${hasRefund}, 敏感词=${sensitive.length > 0}`);
  }

  console.log('示例数据导入完成！');
  db.close();
}

seedData().catch(err => {
  console.error('导入数据失败:', err);
  db.close();
});
