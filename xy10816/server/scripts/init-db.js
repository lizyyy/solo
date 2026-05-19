const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS change_history`);
  db.run(`DROP TABLE IF EXISTS call_mapping`);
  db.run(`DROP TABLE IF EXISTS error_codes`);
  db.run(`DROP TABLE IF EXISTS teams`);
  db.run(`DROP TABLE IF EXISTS api_requests`);

  db.run(`
    CREATE TABLE teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      leader TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE error_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_code TEXT NOT NULL,
      api_path TEXT NOT NULL,
      user_message TEXT NOT NULL,
      debug_message TEXT,
      troubleshooting TEXT,
      team_id INTEGER,
      status TEXT DEFAULT 'draft',
      version INTEGER DEFAULT 1,
      merged_from TEXT,
      approved_by TEXT,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      UNIQUE(error_code, api_path, version)
    )
  `);

  db.run(`
    CREATE TABLE call_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_code_id INTEGER NOT NULL,
      source_system TEXT NOT NULL,
      target_code TEXT,
      mapping_rule TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (error_code_id) REFERENCES error_codes(id)
    )
  `);

  db.run(`
    CREATE TABLE change_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_code_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (error_code_id) REFERENCES error_codes(id)
    )
  `);

  db.run(`
    CREATE TABLE api_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      request_body TEXT,
      response_body TEXT,
      responsible_node TEXT,
      status_code INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表创建完成');

  const teamsStmt = db.prepare(`INSERT INTO teams (name, leader, email) VALUES (?, ?, ?)`);
  teamsStmt.run('支付团队', '张三', 'zhangsan@payment.com');
  teamsStmt.run('用户团队', '李四', 'lisi@user.com');
  teamsStmt.run('订单团队', '王五', 'wangwu@order.com');
  teamsStmt.run('商品团队', '赵六', 'zhaoliu@product.com');
  teamsStmt.finalize();

  const errorsStmt = db.prepare(`
    INSERT INTO error_codes (error_code, api_path, user_message, debug_message, troubleshooting, team_id, status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  errorsStmt.run(
    'PAY_001', '/api/payment/create',
    '支付失败，请检查余额',
    'Insufficient balance in user account',
    '1. 检查账户余额 2. 确认支付渠道 3. 联系客服',
    1, 'approved', 1
  );
  errorsStmt.run(
    'PAY_001', '/api/payment/query',
    '支付查询失败，请稍后重试',
    'Payment record not found',
    '1. 检查订单号 2. 等待5分钟后重试',
    1, 'approved', 1
  );
  errorsStmt.run(
    'USER_001', '/api/user/login',
    '登录失败，用户名或密码错误',
    'Invalid credentials provided',
    '1. 检查用户名密码 2. 重置密码 3. 检查账号状态',
    2, 'pending_approval', 2
  );
  errorsStmt.run(
    'ORDER_001', '/api/order/create',
    '订单创建失败，库存不足',
    'Product out of stock',
    '1. 检查商品库存 2. 选择其他规格',
    3, 'draft', 1
  );
  errorsStmt.run(
    'PROD_001', '/api/product/detail',
    '商品不存在或已下架',
    'Product not found or offline',
    '1. 检查商品ID 2. 确认上架状态',
    4, 'rejected', 1
  );
  errorsStmt.finalize();

  const mappingStmt = db.prepare(`
    INSERT INTO call_mapping (error_code_id, source_system, target_code, mapping_rule)
    VALUES (?, ?, ?, ?)
  `);
  mappingStmt.run(1, '支付宝网关', 'ALIPAY_2001', '直接映射');
  mappingStmt.run(1, '微信支付', 'WXPAY_4001', '余额不足统一映射');
  mappingStmt.run(3, '统一认证中心', 'AUTH_1001', '认证失败归并');
  mappingStmt.finalize();

  const historyStmt = db.prepare(`
    INSERT INTO change_history (error_code_id, action, old_value, new_value, operator, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  historyStmt.run(1, 'create', null, '初始版本', 'system', '系统初始化');
  historyStmt.run(3, 'update', '登录失败', '登录失败，用户名或密码错误', 'admin', '优化用户体验');
  historyStmt.run(3, 'status_change', 'draft', 'pending_approval', 'admin', '提交审批');
  historyStmt.run(5, 'status_change', 'pending_approval', 'rejected', 'leader', '需要补充排查建议');
  historyStmt.finalize();

  console.log('样例数据插入完成');
});

db.close();
