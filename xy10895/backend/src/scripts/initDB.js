const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/api_catalog.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS api_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'reviewing', 'active', 'deprecated', 'archived')),
    owner_id INTEGER,
    permission_level TEXT DEFAULT 'internal' CHECK(permission_level IN ('public', 'internal', 'confidential', 'restricted')),
    version TEXT DEFAULT '1.0.0',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS permission_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_id) REFERENCES api_entries(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS example_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    request_body TEXT,
    response_body TEXT,
    headers TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_id) REFERENCES api_entries(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER NOT NULL,
    change_type TEXT NOT NULL CHECK(change_type IN ('create', 'update', 'status_change', 'owner_change', 'permission_change', 'example_add', 'example_remove')),
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_id) REFERENCES api_entries(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_id, user_email),
    FOREIGN KEY (api_id) REFERENCES api_entries(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_id, user_email),
    FOREIGN KEY (api_id) REFERENCES api_entries(id) ON DELETE CASCADE
  )`);

  console.log('Database tables created successfully!');

  const ownerStmt = db.prepare('INSERT OR IGNORE INTO owners (name, email, department) VALUES (?, ?, ?)');
  ownerStmt.run('张三', 'zhangsan@company.com', '技术部');
  ownerStmt.run('李四', 'lisi@company.com', '产品部');
  ownerStmt.run('王五', 'wangwu@company.com', '运维部');
  ownerStmt.finalize();

  const apiStmt = db.prepare(`INSERT INTO api_entries 
    (name, description, endpoint, method, status, owner_id, permission_level, version) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  apiStmt.run(
    '获取用户信息',
    '根据用户ID获取用户详细信息',
    '/api/v1/users/:id',
    'GET',
    'active',
    1,
    'internal',
    '1.0.0'
  );
  apiStmt.run(
    '创建订单',
    '创建新的订单记录',
    '/api/v1/orders',
    'POST',
    'active',
    1,
    'confidential',
    '2.1.0'
  );
  apiStmt.run(
    '删除商品',
    '删除指定商品记录',
    '/api/v1/products/:id',
    'DELETE',
    'deprecated',
    2,
    'restricted',
    '1.5.0'
  );
  apiStmt.finalize();

  const exampleStmt = db.prepare(`INSERT INTO example_requests 
    (api_id, title, request_body, response_body, headers) 
    VALUES (?, ?, ?, ?, ?)`);
  exampleStmt.run(
    1,
    '正常请求示例',
    '{}',
    '{"id": 1, "name": "用户A", "email": "user@example.com"}',
    '{"Authorization": "Bearer token"}'
  );
  exampleStmt.run(
    2,
    '创建订单示例',
    '{"productId": 123, "quantity": 2}',
    '{"orderId": "ORD001", "status": "created"}',
    '{"Content-Type": "application/json"}'
  );
  exampleStmt.finalize();

  const permStmt = db.prepare('INSERT INTO permission_requirements (api_id, role, description) VALUES (?, ?, ?)');
  permStmt.run(1, 'user', '普通用户可访问');
  permStmt.run(2, 'admin', '需要管理员权限');
  permStmt.run(3, 'super_admin', '需要超级管理员权限');
  permStmt.finalize();

  const logStmt = db.prepare(`INSERT INTO change_logs 
    (api_id, change_type, new_value, changed_by, description) 
    VALUES (?, ?, ?, ?, ?)`);
  logStmt.run(1, 'create', 'active', 'system', 'API初始创建');
  logStmt.run(2, 'create', 'active', 'system', 'API初始创建');
  logStmt.run(3, 'status_change', 'deprecated', 'zhangsan@company.com', 'API标记为废弃');
  logStmt.finalize();

  console.log('Sample data inserted successfully!');
});

db.close();
