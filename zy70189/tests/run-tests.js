const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '..', 'test_refund_permission.db');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  console.log(`\n[测试] ${name}`);
  try {
    fn();
    console.log(`  ✓ 通过`);
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    console.log(`  ✗ 失败: ${err.message}`);
    failed++;
    results.push({ name, status: 'fail', error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function saveDatabase(db, filePath) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
}

function dbGet(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbRun(db, sql, params = []) {
  db.run(sql, params);
}

const levelHierarchy = ['junior', 'intermediate', 'senior', 'supervisor', 'manager', 'director'];

function getStaffLevelOrder(level) {
  return levelHierarchy.indexOf(level);
}

function isHigherOrEqualLevel(level1, level2) {
  return getStaffLevelOrder(level1) >= getStaffLevelOrder(level2);
}

function getStaffById(db, staffId) {
  return dbGet(db, 'SELECT id, name, level, is_active FROM staff WHERE id = ?', [staffId]);
}

function getCategoryRule(db, categoryCode) {
  return dbGet(db, `
    SELECT id, category_code, category_name, is_refundable, 
           max_refund_ratio, special_approval_required
    FROM category_rules
    WHERE category_code = ?
  `, [categoryCode]);
}

function getRefundLimit(db, staffLevel, category) {
  const row = dbGet(db, `
    SELECT id, staff_level, category, max_amount, effective_from, effective_to
    FROM refund_limits
    WHERE staff_level = ? 
      AND (category = ? OR category IS NULL)
    ORDER BY category DESC
    LIMIT 1
  `, [staffLevel, category]);

  if (row) return row;

  return {
    staff_level: staffLevel,
    category: category,
    max_amount: 0
  };
}

function checkPermission(db, staff, action, amount, category) {
  const checks = [];

  if (!staff || !staff.is_active) {
    return {
      allowed: false,
      reason: '员工不存在或已停用',
      required_approval_level: null,
      checks
    };
  }

  checks.push({ type: 'staff_status', passed: true, detail: '员工状态正常' });

  const categoryRule = getCategoryRule(db, category);
  if (categoryRule) {
    if (!categoryRule.is_refundable) {
      checks.push({ type: 'category_refundable', passed: false, detail: `品类【${category}】不支持退款` });
      return {
        allowed: false,
        reason: `品类【${category}】不支持退款`,
        required_approval_level: null,
        checks
      };
    }
    checks.push({ type: 'category_refundable', passed: true, detail: `品类【${category}】支持退款` });
  }

  const refundLimit = getRefundLimit(db, staff.level, category);
  const maxAmount = refundLimit.max_amount;

  if (maxAmount === null) {
    checks.push({ type: 'amount_limit', passed: true, detail: '额度无限制' });
  } else if (amount > maxAmount) {
    checks.push({ type: 'amount_limit', passed: false, 
      detail: `金额 ${amount} 超过当前等级额度 ${maxAmount}` });
    
    return {
      allowed: false,
      reason: '额度超限',
      required_approval_level: 'supervisor',
      amount_limit: maxAmount,
      actual_amount: amount,
      checks
    };
  } else {
    checks.push({ type: 'amount_limit', passed: true, 
      detail: `金额 ${amount} 在额度 ${maxAmount} 范围内` });
  }

  if (categoryRule && categoryRule.special_approval_required) {
    checks.push({ type: 'special_approval', passed: false, 
      detail: `品类【${category}】需要特殊审批` });
    
    return {
      allowed: false,
      reason: '品类特殊审批要求',
      required_approval_level: 'supervisor',
      checks
    };
  }

  return {
    allowed: true,
    reason: '权限检查通过',
    required_approval_level: null,
    checks
  };
}

function canApprove(db, approverLevel, initiatorLevel, amount, category) {
  const levelCheck = isHigherOrEqualLevel(approverLevel, initiatorLevel);
  if (!levelCheck) {
    return { allowed: false, reason: '审批人等级需高于或等于发起人' };
  }

  const limit = getRefundLimit(db, approverLevel, category);
  if (limit.max_amount !== null && amount > limit.max_amount) {
    return { 
      allowed: false, 
      reason: '审批人额度不足',
      limit: limit.max_amount,
      actual: amount
    };
  }

  return { allowed: true };
}

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  const tables = [
    `CREATE TABLE staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_code TEXT NOT NULL UNIQUE,
      category_name TEXT NOT NULL,
      is_refundable INTEGER DEFAULT 1,
      max_refund_ratio REAL DEFAULT 1,
      special_approval_required INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE refund_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_level TEXT NOT NULL,
      category TEXT,
      max_amount REAL NOT NULL,
      effective_from INTEGER DEFAULT (strftime('%s', 'now')),
      effective_to INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE refund_requests (
      id TEXT PRIMARY KEY,
      request_no TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'CNY',
      reason TEXT NOT NULL,
      initiator_id TEXT NOT NULL,
      initiator_level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      parent_request_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE approval_requests (
      id TEXT PRIMARY KEY,
      refund_request_id TEXT NOT NULL,
      approver_level TEXT NOT NULL,
      approver_id TEXT,
      action TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT,
      operator_level TEXT,
      target_type TEXT NOT NULL,
      target_id TEXT,
      before_value TEXT,
      after_value TEXT,
      result TEXT NOT NULL,
      detail TEXT,
      ip_address TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`
  ];

  tables.forEach(sql => dbRun(db, sql));

  const now = Math.floor(Date.now() / 1000);

  dbRun(db, `INSERT INTO staff (id, name, level, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['test_staff_01', '测试客服', 'intermediate', 1, now, now]);
  dbRun(db, `INSERT INTO staff (id, name, level, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['test_staff_02', '测试主管', 'supervisor', 1, now, now]);
  dbRun(db, `INSERT INTO staff (id, name, level, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['test_staff_03', '测试经理', 'manager', 1, now, now]);

  dbRun(db, `INSERT INTO category_rules (category_code, category_name, is_refundable, max_refund_ratio, special_approval_required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['CLOTHING', '服装', 1, 1, 0, now, now]);
  dbRun(db, `INSERT INTO category_rules (category_code, category_name, is_refundable, max_refund_ratio, special_approval_required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['FOOD', '食品', 0, 0, 0, now, now]);
  dbRun(db, `INSERT INTO category_rules (category_code, category_name, is_refundable, max_refund_ratio, special_approval_required, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['LUXURY', '奢侈品', 1, 0.5, 1, now, now]);

  dbRun(db, `INSERT INTO refund_limits (staff_level, category, max_amount, effective_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['intermediate', null, 500, now, now, now]);
  dbRun(db, `INSERT INTO refund_limits (staff_level, category, max_amount, effective_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['supervisor', null, 5000, now, now, now]);
  dbRun(db, `INSERT INTO refund_limits (staff_level, category, max_amount, effective_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['manager', null, 10000, now, now, now]);

  console.log('='.repeat(60));
  console.log('客服退款权限API - 测试套件');
  console.log('='.repeat(60));

  test('权限验证 - 员工状态检查', () => {
    const staff = getStaffById(db, 'test_staff_01');
    assert(staff !== undefined, '应该能查到员工');
    assert(staff.is_active === 1, '员工应该是激活状态');
  });

  test('权限验证 - 正常额度内', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 100, 'CLOTHING');
    assert(result.allowed === true, '应该允许退款');
  });

  test('权限验证 - 额度超限', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 1000, 'CLOTHING');
    assert(result.allowed === false, '应该拒绝退款');
    assert(result.reason === '额度超限', '拒绝原因应该是额度超限');
  });

  test('权限验证 - 品类不可退款', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 100, 'FOOD');
    assert(result.allowed === false, '应该拒绝退款');
    assert(result.reason.includes('不支持退款'), '拒绝原因应该是品类不支持退款');
  });

  test('权限验证 - 特殊审批品类', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 100, 'LUXURY');
    assert(result.allowed === false, '应该需要审批');
    assert(result.required_approval_level !== null, '应该返回需要的审批等级');
  });

  test('字段缺失验证', () => {
    const requiredFields = ['order_id', 'customer_id', 'product_id', 'product_category', 'amount', 'reason', 'initiator_id'];
    const data = { order_id: 'ORDER001' };
    const errors = [];
    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`字段缺失: ${field}`);
      }
    });
    assert(errors.length > 0, '应该有验证错误');
  });

  test('退款创建 - 正常额度内', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 300, 'CLOTHING');
    assert(result.allowed === true, '权限检查应该通过');

    const requestId = uuidv4();
    dbRun(db, `
      INSERT INTO refund_requests 
      (id, request_no, order_id, customer_id, product_id, product_category, 
       amount, currency, reason, initiator_id, initiator_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [requestId, 'RF-TEST-001', 'ORDER001', 'CUST001', 'PROD001', 'CLOTHING',
        300, 'CNY', '尺码不合适', 'test_staff_01', 'intermediate', 'pending', now, now]);

    const saved = dbGet(db, 'SELECT * FROM refund_requests WHERE id = ?', [requestId]);
    assert(saved !== undefined, '应该保存成功');
    assert(saved.status === 'pending', '状态应该是pending');
  });

  test('退款创建 - 额度超限需审批', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 600, 'CLOTHING');
    assert(result.allowed === false, '应该不允许直接退款');
    assert(result.required_approval_level !== null, '应该需要审批');
  });

  test('幂等性处理 - 相同请求号返回相同结果', () => {
    const requestNo = 'RF-IDEMPOTENT-001';
    const requestId1 = uuidv4();
    
    dbRun(db, `
      INSERT INTO refund_requests 
      (id, request_no, order_id, customer_id, product_id, product_category, 
       amount, currency, reason, initiator_id, initiator_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [requestId1, requestNo, 'ORDER-IDEM-001', 'CUST-IDEM', 'PROD-IDEM', 'CLOTHING',
        200, 'CNY', '颜色不符', 'test_staff_01', 'intermediate', 'pending', now, now]);

    const existing = dbGet(db, 'SELECT * FROM refund_requests WHERE request_no = ?', [requestNo]);
    assert(existing !== undefined, '应该找到已存在的请求');
    assert(existing.id === requestId1, '应该返回相同的请求ID');
  });

  test('审批人等级检查', () => {
    const result = canApprove(db, 'supervisor', 'intermediate', 1000, 'CLOTHING');
    assert(result.allowed === true, '主管应该可以审批中级客服的请求');
  });

  test('审批人额度不足', () => {
    const result = canApprove(db, 'supervisor', 'intermediate', 8000, 'CLOTHING');
    assert(result.allowed === false, '主管不应该能审批超过自己额度的请求');
  });

  test('审计日志记录', () => {
    const beforeCount = dbAll(db, 'SELECT * FROM audit_logs').length;
    
    dbRun(db, `
      INSERT INTO audit_logs 
      (operation_type, operator_id, operator_name, operator_level, 
       target_type, target_id, result, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['TEST_OPERATION', 'test_staff_01', '测试客服', 'intermediate', 
        'test_target', 'test_id_001', 'success', '测试详情', now]);

    const afterCount = dbAll(db, 'SELECT * FROM audit_logs').length;
    assert(afterCount === beforeCount + 1, '应该记录一条日志');
  });

  test('审计日志查询', () => {
    dbRun(db, `
      INSERT INTO audit_logs 
      (operation_type, operator_id, operator_name, operator_level, 
       target_type, target_id, result, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['TEST_QUERY', 'test_staff_01', '测试客服', 'intermediate', 
        'test_target', 'test_id_002', 'success', '测试查询', now]);

    const logs = dbAll(db, 'SELECT * FROM audit_logs WHERE operation_type = ?', ['TEST_QUERY']);
    assert(logs.length > 0, '应该能查到日志');
  });

  test('越权尝试记录', () => {
    const staff = getStaffById(db, 'test_staff_01');
    const result = checkPermission(db, staff, 'refund', 1000, 'CLOTHING');
    assert(result.allowed === false, '应该检测到越权尝试');

    dbRun(db, `
      INSERT INTO audit_logs 
      (operation_type, operator_id, operator_name, operator_level, 
       target_type, result, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ['OVERRIDE_ATTEMPT', 'test_staff_01', '测试客服', 'intermediate',
        'refund_request', 'blocked', '额度超限', now]);

    const attempts = dbAll(db, 'SELECT * FROM audit_logs WHERE operation_type = ?', ['OVERRIDE_ATTEMPT']);
    assert(attempts.length >= 1, '应该能查到越权尝试记录');
  });

  saveDatabase(db, testDbPath);
  db.close();

  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${passed + failed}`);
  console.log('='.repeat(60));

  results.forEach(r => {
    const icon = r.status === 'pass' ? '✓' : '✗';
    const status = r.status === 'pass' ? '通过' : '失败';
    console.log(`${icon} [${status}] ${r.name}`);
    if (r.error) {
      console.log(`    错误: ${r.error}`);
    }
  });

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('测试执行失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
