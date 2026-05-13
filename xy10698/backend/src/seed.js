const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/knowledge_base.db');
const db = new sqlite3.Database(dbPath);

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seed() {
  try {
    await runQuery(`CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS reply_versions (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_current BOOLEAN DEFAULT 1,
      FOREIGN KEY (intent_id) REFERENCES intents(id)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS hit_records (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      reply_version_id TEXT NOT NULL,
      session_id TEXT,
      user_query TEXT NOT NULL,
      agent_id TEXT,
      adopted BOOLEAN DEFAULT 0,
      follow_up BOOLEAN DEFAULT 0,
      hit_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intent_id) REFERENCES intents(id),
      FOREIGN KEY (reply_version_id) REFERENCES reply_versions(id)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY,
      hit_record_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      reported_by TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      merged_from TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hit_record_id) REFERENCES hit_records(id)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      reply_version_id TEXT,
      action TEXT NOT NULL,
      previous_content TEXT,
      new_content TEXT,
      revised_by TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intent_id) REFERENCES intents(id),
      FOREIGN KEY (reply_version_id) REFERENCES reply_versions(id)
    )`);

    await runQuery(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('数据库表初始化完成');

    const users = [
      { id: 'user-1', name: '张三', role: 'agent', email: 'zhangsan@example.com' },
      { id: 'user-2', name: '李四', role: 'agent', email: 'lisi@example.com' },
      { id: 'user-3', name: '王运营', role: 'operator', email: 'wang@example.com' },
      { id: 'user-4', name: '赵主管', role: 'supervisor', email: 'zhao@example.com' },
    ];

    for (const user of users) {
      await runQuery('INSERT OR IGNORE INTO users (id, name, role, email) VALUES (?, ?, ?, ?)', 
        [user.id, user.name, user.role, user.email]);
    }
    console.log('用户数据插入完成');

    const intents = [
      { id: 'intent-1', name: '退款流程', description: '用户咨询退款相关问题', category: '订单' },
      { id: 'intent-2', name: '物流查询', description: '用户查询物流信息', category: '配送' },
      { id: 'intent-3', name: '退换货政策', description: '用户咨询退换货规则', category: '售后' },
      { id: 'intent-4', name: '优惠券使用', description: '优惠券使用方法', category: '促销' },
      { id: 'intent-5', name: '账户注销', description: '账户注销流程', category: '账户' },
    ];

    for (const intent of intents) {
      await runQuery('INSERT OR IGNORE INTO intents (id, name, description, category) VALUES (?, ?, ?, ?)',
        [intent.id, intent.name, intent.description, intent.category]);
    }
    console.log('意图数据插入完成');

    const replyVersions = [
      { id: 'rv-1', intent_id: 'intent-1', content: '您好，退款流程如下：1. 进入"我的订单" 2. 选择需退款订单 3. 点击"申请退款" 4. 填写原因提交。审核时间1-3个工作日。', version: 1, created_by: 'user-3', is_current: 0 },
      { id: 'rv-2', intent_id: 'intent-1', content: '您好，退款流程：1. 进入"我的订单"页 2. 选择目标订单 3. 点击"申请退款" 4. 填写退款原因并提交。审核通常1-3个工作日，金额将原路返回。', version: 2, created_by: 'user-3', is_current: 1 },
      { id: 'rv-3', intent_id: 'intent-2', content: '您可以在"我的订单"中点击对应订单查看物流跟踪信息，更新可能有1-2小时延迟。', version: 1, created_by: 'user-3', is_current: 1 },
      { id: 'rv-4', intent_id: 'intent-3', content: '申请退货请在订单详情页点击"申请退货"，需在签收后7天内提交，非质量问题运费由用户承担。', version: 1, created_by: 'user-3', is_current: 1 },
      { id: 'rv-5', intent_id: 'intent-4', content: '优惠券使用说明：1. 结算时点击"使用优惠券" 2. 选择可用优惠券 3. 确认抵扣。每单限用一张，不可与其他优惠叠加。', version: 1, created_by: 'user-3', is_current: 1 },
      { id: 'rv-6', intent_id: 'intent-5', content: '账户注销请前往设置-账户安全-注销账户，需验证手机号，注销后数据不可恢复，请谨慎操作。', version: 1, created_by: 'user-4', is_current: 1 },
    ];

    for (const rv of replyVersions) {
      await runQuery('INSERT OR IGNORE INTO reply_versions (id, intent_id, content, version, created_by, is_current) VALUES (?, ?, ?, ?, ?, ?)',
        [rv.id, rv.intent_id, rv.content, rv.version, rv.created_by, rv.is_current]);
    }
    console.log('回复版本数据插入完成');

    const hitRecords = [
      { id: 'hr-1', intent_id: 'intent-1', reply_version_id: 'rv-2', session_id: 'sess-001', user_query: '我想退款怎么操作？', agent_id: 'user-1', adopted: 1, follow_up: 0, hit_score: 0.95 },
      { id: 'hr-2', intent_id: 'intent-1', reply_version_id: 'rv-2', session_id: 'sess-002', user_query: '退款多久到账？', agent_id: 'user-1', adopted: 1, follow_up: 1, hit_score: 0.88 },
      { id: 'hr-3', intent_id: 'intent-2', reply_version_id: 'rv-3', session_id: 'sess-003', user_query: '我的快递到哪了？', agent_id: 'user-2', adopted: 1, follow_up: 0, hit_score: 0.92 },
      { id: 'hr-4', intent_id: 'intent-1', reply_version_id: 'rv-1', session_id: 'sess-004', user_query: '退款怎么弄？', agent_id: 'user-2', adopted: 0, follow_up: 1, hit_score: 0.75 },
      { id: 'hr-5', intent_id: 'intent-3', reply_version_id: 'rv-4', session_id: 'sess-005', user_query: '怎么退货？', agent_id: 'user-1', adopted: 1, follow_up: 0, hit_score: 0.90 },
      { id: 'hr-6', intent_id: 'intent-4', reply_version_id: 'rv-5', session_id: 'sess-006', user_query: '优惠券怎么用？', agent_id: 'user-1', adopted: 1, follow_up: 0, hit_score: 0.97 },
      { id: 'hr-7', intent_id: 'intent-5', reply_version_id: 'rv-6', session_id: 'sess-007', user_query: '怎么注销账号？', agent_id: 'user-2', adopted: 1, follow_up: 0, hit_score: 0.94 },
      { id: 'hr-8', intent_id: 'intent-1', reply_version_id: 'rv-2', session_id: 'sess-008', user_query: '退款需要什么条件？', agent_id: 'user-1', adopted: 0, follow_up: 1, hit_score: 0.65 },
    ];

    for (const hr of hitRecords) {
      await runQuery('INSERT OR IGNORE INTO hit_records (id, intent_id, reply_version_id, session_id, user_query, agent_id, adopted, follow_up, hit_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [hr.id, hr.intent_id, hr.reply_version_id, hr.session_id, hr.user_query, hr.agent_id, hr.adopted, hr.follow_up, hr.hit_score]);
    }
    console.log('命中记录数据插入完成');

    const feedbacks = [
      { id: 'fb-1', hit_record_id: 'hr-4', type: 'wrong_answer', reason: '回复内容不完整，用户想知道到账时间', reported_by: 'user-2', status: 'resolved', priority: 'high' },
      { id: 'fb-2', hit_record_id: 'hr-2', type: 'wrong_answer', reason: '用户反馈回复太笼统，需要具体说明', reported_by: 'user-1', status: 'pending', priority: 'medium' },
      { id: 'fb-3', hit_record_id: 'hr-8', type: 'wrong_answer', reason: '没有说明退款条件，用户追问', reported_by: 'user-1', status: 'pending', priority: 'high' },
      { id: 'fb-4', hit_record_id: 'hr-1', type: 'good', reason: '回复准确，用户满意', reported_by: 'user-1', status: 'resolved', priority: 'low' },
    ];

    for (const fb of feedbacks) {
      await runQuery('INSERT OR IGNORE INTO feedbacks (id, hit_record_id, type, reason, reported_by, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fb.id, fb.hit_record_id, fb.type, fb.reason, fb.reported_by, fb.status, fb.priority]);
    }
    console.log('反馈数据插入完成');

    const revisions = [
      { id: 'rev-1', intent_id: 'intent-1', reply_version_id: 'rv-2', action: 'update', previous_content: '旧版内容...', new_content: '您好，退款流程：1. 进入"我的订单"页...', revised_by: 'user-3', remark: '优化表述，增加到账时间说明' },
      { id: 'rev-2', intent_id: 'intent-1', reply_version_id: 'rv-1', action: 'rollback', previous_content: '', new_content: '', revised_by: 'user-4', remark: '回滚到版本1，用户反馈新版有问题' },
    ];

    for (const rev of revisions) {
      await runQuery('INSERT OR IGNORE INTO revisions (id, intent_id, reply_version_id, action, previous_content, new_content, revised_by, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [rev.id, rev.intent_id, rev.reply_version_id, rev.action, rev.previous_content, rev.new_content, rev.revised_by, rev.remark]);
    }
    console.log('修订记录数据插入完成');

    console.log('\n=== 造数完成！ ===');
    db.close();
  } catch (err) {
    console.error('造数失败:', err);
    db.close();
  }
}

seed();
