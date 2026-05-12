const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = path.join(__dirname, '../data/audit.db');
const db = new sqlite3.Database(dbPath);

function now() {
  return new Date().toISOString();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function daysLater(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

async function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function seedData() {
  console.log('开始创建样例数据...');

  const auditId = uuidv4();
  console.log(`审核ID: ${auditId}`);

  const case1Id = await createClosedCase(auditId);
  const case2Id = await createRejectedCase(auditId);
  const case3Id = await createExtensionCase(auditId);
  const case4Id = await createEscalatedCase(auditId);
  const case5Id = await createPendingCase(auditId);

  console.log('\n========================================');
  console.log('样例数据创建完成:');
  console.log('========================================');
  console.log(`1. 整改通过 (CLOSED - 客户已认可): ${case1Id}`);
  console.log(`2. 证据不足退回 (REJECTED - 需重新整改): ${case2Id}`);
  console.log(`3. 延期审批 (PLAN_APPROVED - 已延期): ${case3Id}`);
  console.log(`4. 逾期升级 (ESCALATED - 严重逾期): ${case4Id}`);
  console.log(`5. 待处理 (OPEN - 新建待处理): ${case5Id}`);
  console.log('========================================\n');

  db.close();
}

async function createClosedCase(auditId) {
  const id = uuidv4();
  const createdAt = daysAgo(10);
  
  await runAsync(
    `INSERT INTO audit_issues 
     (id, audit_id, issue_number, title, description, risk_level, responsible_department, 
      status, due_date, original_due_date, customer_approved, created_by, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auditId, 'ISSUE-001', '生产车间消防通道堵塞', 
     '客户审核发现3号车间消防通道被原材料堆放堵塞，不符合消防安全规定',
     '高风险', '生产部', 'CLOSED', daysAgo(3), daysAgo(3), 1, 
     '张经理', createdAt, daysAgo(2), 5]
  );

  await runAsync(
    'INSERT INTO rectification_plans (id, issue_id, plan_content, responsible_person, target_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, '1. 24小时内清理通道堆放物；2. 划定通道区域标识；3. 组织消防培训；4. 建立日常巡检制度', 
     '李主管', daysAgo(7), daysAgo(9)]
  );

  await runAsync(
    'INSERT INTO evidences (id, issue_id, version, content, file_url, submitted_by, submitted_at, is_valid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 1, '清理前后对比照片8张、通道标识安装照片、培训签到表、巡检记录表', 
     '/files/evidence-001-v1.pdf', '李主管', daysAgo(6), 1]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'PLAN_APPROVAL', '王总', 'APPROVED', '计划可行，请严格执行', daysAgo(8)]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'CUSTOMER_REVIEW', '客户审核员-陈工', 'APPROVED', '整改措施到位，证据充分，问题关闭', daysAgo(2)]
  );

  const histories = [
    [null, 'OPEN', '创建问题', '张经理', '审核发现问题'],
    ['OPEN', 'PLAN_SUBMITTED', '提交整改计划', '李主管', '整改计划已提交'],
    ['PLAN_SUBMITTED', 'PLAN_APPROVED', '审批通过', '王总', '计划可行，请严格执行'],
    ['PLAN_APPROVED', 'EVIDENCE_SUBMITTED', '提交证据(版本1)', '李主管', '证据已提交'],
    ['EVIDENCE_SUBMITTED', 'CLOSED', '客户审核通过', '客户审核员-陈工', '整改措施到位，证据充分，问题关闭']
  ];

  for (let i = 0; i < histories.length; i++) {
    await runAsync(
      'INSERT INTO status_history (id, issue_id, from_status, to_status, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, histories[i][0], histories[i][1], histories[i][2], histories[i][3], histories[i][4], daysAgo(10 - i)]
    );
  }

  return id;
}

async function createRejectedCase(auditId) {
  const id = uuidv4();
  const createdAt = daysAgo(5);
  
  await runAsync(
    `INSERT INTO audit_issues 
     (id, audit_id, issue_number, title, description, risk_level, responsible_department, 
      status, due_date, original_due_date, customer_approved, created_by, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auditId, 'ISSUE-002', '质检记录缺少签字确认', 
     '部分批次质检报告只有电子档，缺少质检人员手写签字，客户认为无法追溯责任',
     '中风险', '质量部', 'REJECTED', daysLater(2), daysAgo(2), 0, 
     '张经理', createdAt, daysAgo(1), 5]
  );

  await runAsync(
    'INSERT INTO rectification_plans (id, issue_id, plan_content, responsible_person, target_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, '1. 补签所有缺失签字；2. 完善质检流程，要求必须签字后才可以归档', 
     '赵质检', daysAgo(2), daysAgo(4)]
  );

  await runAsync(
    'INSERT INTO evidences (id, issue_id, version, content, file_url, submitted_by, submitted_at, is_valid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 1, '电子档质检报告截图(无签字)', 
     '/files/evidence-002-v1.pdf', '赵质检', daysAgo(3), 1]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'PLAN_APPROVAL', '王总', 'APPROVED', '同意此方案', daysAgo(4)]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'CUSTOMER_REVIEW', '客户审核员-陈工', 'REJECTED', '证据不足，缺少手写签字原件扫描件，请重新提交', daysAgo(1)]
  );

  const histories = [
    [null, 'OPEN', '创建问题', '张经理', '审核发现问题'],
    ['OPEN', 'PLAN_SUBMITTED', '提交整改计划', '赵质检', '整改计划已提交'],
    ['PLAN_SUBMITTED', 'PLAN_APPROVED', '审批通过', '王总', '同意此方案'],
    ['PLAN_APPROVED', 'EVIDENCE_SUBMITTED', '提交证据(版本1)', '赵质检', '证据已提交'],
    ['EVIDENCE_SUBMITTED', 'REJECTED', '客户退回', '客户审核员-陈工', '证据不足，缺少手写签字原件扫描件，请重新提交']
  ];

  for (let i = 0; i < histories.length; i++) {
    await runAsync(
      'INSERT INTO status_history (id, issue_id, from_status, to_status, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, histories[i][0], histories[i][1], histories[i][2], histories[i][3], histories[i][4], daysAgo(5 - i)]
    );
  }

  return id;
}

async function createExtensionCase(auditId) {
  const id = uuidv4();
  const createdAt = daysAgo(3);
  
  await runAsync(
    `INSERT INTO audit_issues 
     (id, audit_id, issue_number, title, description, risk_level, responsible_department, 
      status, due_date, original_due_date, customer_approved, created_by, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auditId, 'ISSUE-003', '供应商资质文件过期', 
     '关键原材料供应商的ISO9001证书已于2024年12月过期，新证书尚未提供',
     '高风险', '采购部', 'PLAN_APPROVED', daysLater(10), daysAgo(2), 0, 
     '张经理', createdAt, daysAgo(2), 4]
  );

  await runAsync(
    'INSERT INTO rectification_plans (id, issue_id, plan_content, responsible_person, target_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, '1. 催促供应商提供新证书；2. 如无法提供则启动备选供应商评估', 
     '孙采购', daysAgo(2), daysAgo(2)]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'PLAN_APPROVAL', '王总', 'APPROVED', '同意，同时启动备选供应商评估', daysAgo(2)]
  );

  await runAsync(
    'INSERT INTO correction_records (id, issue_id, field_name, old_value, new_value, corrected_by, reason, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'due_date', daysAgo(2), daysLater(10), '王总', '延期审批: 供应商正在办理新证书，预计10天内可提供', daysAgo(2)]
  );

  const histories = [
    [null, 'OPEN', '创建问题', '张经理', '审核发现问题'],
    ['OPEN', 'PLAN_SUBMITTED', '提交整改计划', '孙采购', '整改计划已提交'],
    ['PLAN_SUBMITTED', 'PLAN_APPROVED', '审批通过', '王总', '同意，同时启动备选供应商评估'],
    ['PLAN_APPROVED', 'PLAN_APPROVED', '延期审批', '王总', '供应商正在办理新证书，预计10天内可提供']
  ];

  for (let i = 0; i < histories.length; i++) {
    await runAsync(
      'INSERT INTO status_history (id, issue_id, from_status, to_status, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, histories[i][0], histories[i][1], histories[i][2], histories[i][3], histories[i][4], daysAgo(3 - i)]
    );
  }

  return id;
}

async function createEscalatedCase(auditId) {
  const id = uuidv4();
  const createdAt = daysAgo(14);
  
  await runAsync(
    `INSERT INTO audit_issues 
     (id, audit_id, issue_number, title, description, risk_level, responsible_department, 
      status, due_date, original_due_date, customer_approved, created_by, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auditId, 'ISSUE-004', '员工培训记录不完整', 
     '新入职员工安全培训记录缺失，现场抽查发现3名新员工无法正确使用灭火器',
     '高风险', '人力资源部', 'ESCALATED', daysAgo(7), daysAgo(7), 0, 
     '张经理', createdAt, daysAgo(3), 6]
  );

  await runAsync(
    'INSERT INTO rectification_plans (id, issue_id, plan_content, responsible_person, target_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, '1. 立即组织安全培训；2. 完善培训记录管理流程', 
     '周HR', daysAgo(10), daysAgo(12)]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, 'PLAN_APPROVAL', '王总', 'APPROVED', '高风险问题，请立即执行', daysAgo(11)]
  );

  const histories = [
    [null, 'OPEN', '创建问题', '张经理', '审核发现问题'],
    ['OPEN', 'PLAN_SUBMITTED', '提交整改计划', '周HR', '整改计划已提交'],
    ['PLAN_SUBMITTED', 'PLAN_APPROVED', '审批通过', '王总', '高风险问题，请立即执行'],
    ['PLAN_APPROVED', 'OVERDUE', '逾期标记', 'system', '超过整改期限'],
    ['OVERDUE', 'ESCALATED', '逾期升级', 'system', '逾期超过3天，已升级']
  ];

  for (let i = 0; i < histories.length; i++) {
    await runAsync(
      'INSERT INTO status_history (id, issue_id, from_status, to_status, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, histories[i][0], histories[i][1], histories[i][2], histories[i][3], histories[i][4], daysAgo(14 - i * 2)]
    );
  }

  return id;
}

async function createPendingCase(auditId) {
  const id = uuidv4();
  const createdAt = daysAgo(1);
  
  await runAsync(
    `INSERT INTO audit_issues 
     (id, audit_id, issue_number, title, description, risk_level, responsible_department, 
      status, due_date, original_due_date, customer_approved, created_by, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auditId, 'ISSUE-005', '设备校准标签缺失', 
     '车间内3台检测设备未贴校准合格标签，无法确认是否在校准有效期内',
     '低风险', '设备部', 'OPEN', daysLater(6), daysLater(6), 0, 
     '张经理', createdAt, createdAt, 1]
  );

  await runAsync(
    'INSERT INTO status_history (id, issue_id, from_status, to_status, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, null, 'OPEN', '创建问题', '张经理', '审核发现问题', createdAt]
  );

  return id;
}

seedData().catch(err => {
  console.error('创建样例数据失败:', err);
  db.close();
});
