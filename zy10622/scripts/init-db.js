const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '../data');
const DB_PATH = path.join(dataDir, 'auth-permissions.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

const STATUS = {
  PENDING_CONFIRM: 'pending_confirm',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

db.serialize(() => {
  db.run('PRAGMA foreign_keys = OFF');

  console.log('正在创建数据库表...');

  db.run(`DROP TABLE IF EXISTS permission_history`);
  db.run(`DROP TABLE IF EXISTS temp_permissions`);
  db.run(`DROP TABLE IF EXISTS permission_packages`);
  db.run(`DROP TABLE IF EXISTS users`);

  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE permission_packages (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE temp_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      permission_package_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      valid_from INTEGER,
      valid_to INTEGER,
      applied_by TEXT NOT NULL,
      confirmed_by TEXT,
      confirmed_at INTEGER,
      revoked_by TEXT,
      revoked_at INTEGER,
      revoked_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (permission_package_id) REFERENCES permission_packages(id)
    )
  `);

  db.run(`
    CREATE TABLE permission_history (
      id TEXT PRIMARY KEY,
      temp_permission_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (temp_permission_id) REFERENCES temp_permissions(id)
    )
  `);

  console.log('表结构创建完成，正在插入初始数据...');

  const now = Date.now();

  const stmtUsers = db.prepare('INSERT INTO users (id, username, name, email, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const users = [
    { id: 'u001', username: 'admin', name: '系统管理员', email: 'admin@example.com', department: '技术部' },
    { id: 'u002', username: 'zhangsan', name: '张三', email: 'zhangsan@example.com', department: '财务部' },
    { id: 'u003', username: 'lisi', name: '李四', email: 'lisi@example.com', department: '运营部' },
    { id: 'u004', username: 'wangwu', name: '王五', email: 'wangwu@example.com', department: '市场部' },
    { id: 'u005', username: 'zhaoliu', name: '赵六', email: 'zhaoliu@example.com', department: '人力资源部' }
  ];
  users.forEach(u => stmtUsers.run(u.id, u.username, u.name, u.email, u.department, now, now));
  stmtUsers.finalize();

  const stmtPkgs = db.prepare('INSERT INTO permission_packages (id, code, name, description, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const packages = [
    { id: 'p001', code: 'FINANCE_VIEW', name: '财务数据查看', description: '查看财务报表和流水', permissions: JSON.stringify(['finance:view', 'finance:report']) },
    { id: 'p002', code: 'USER_MANAGE', name: '用户管理', description: '用户增删改查', permissions: JSON.stringify(['user:create', 'user:read', 'user:update', 'user:delete']) },
    { id: 'p003', code: 'SYSTEM_CONFIG', name: '系统配置', description: '系统参数配置', permissions: JSON.stringify(['system:config', 'system:log']) },
    { id: 'p004', code: 'DATA_EXPORT', name: '数据导出', description: '批量数据导出权限', permissions: JSON.stringify(['data:export', 'data:download']) },
    { id: 'p005', code: 'AUDIT_VIEW', name: '审计日志查看', description: '查看系统审计日志', permissions: JSON.stringify(['audit:view', 'audit:export']) }
  ];
  packages.forEach(p => stmtPkgs.run(p.id, p.code, p.name, p.description, p.permissions, now, now));
  stmtPkgs.finalize();

  const stmtPerms = db.prepare('INSERT INTO temp_permissions (id, user_id, permission_package_id, reason, status, valid_from, valid_to, applied_by, confirmed_by, confirmed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const stmtPerms2 = db.prepare('INSERT INTO temp_permissions (id, user_id, permission_package_id, reason, status, valid_from, valid_to, applied_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const stmtPerms3 = db.prepare('INSERT INTO temp_permissions (id, user_id, permission_package_id, reason, status, valid_from, valid_to, applied_by, confirmed_by, confirmed_at, revoked_by, revoked_at, revoked_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const stmtPerms4 = db.prepare('INSERT INTO temp_permissions (id, user_id, permission_package_id, reason, status, applied_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  const oneDay = 24 * 60 * 60 * 1000;

  stmtPerms.run(
    'tp001', 'u002', 'p001', '月度财务报表审计工作需要', STATUS.ACTIVE,
    now - oneDay, now + 6 * oneDay,
    'u002', 'u001', now - oneDay,
    now - oneDay, now
  );

  stmtPerms2.run(
    'tp002', 'u003', 'p004', '运营数据批量导出分析', STATUS.PENDING_CONFIRM,
    now, now + 14 * oneDay,
    'u003', now, now
  );

  stmtPerms3.run(
    'tp003', 'u004', 'p002', '临时招聘期间用户管理', STATUS.REVOKED,
    now - 10 * oneDay, now + 4 * oneDay,
    'u004', 'u001', now - 10 * oneDay,
    'u001', now - 2 * oneDay, '招聘工作已完成',
    now - 10 * oneDay, now - 2 * oneDay
  );

  stmtPerms4.run(
    'tp004', 'u005', 'p003', '员工入职系统配置', STATUS.EXPIRED,
    'u005', now - 30 * oneDay, now - 30 * oneDay
  );

  stmtPerms.finalize();
  stmtPerms2.finalize();
  stmtPerms3.finalize();
  stmtPerms4.finalize();

  db.run('PRAGMA foreign_keys = ON');

  console.log('✅ 数据库初始化完成！');
  console.log('📍 数据库位置:', DB_PATH);
  console.log('📊 初始数据:');
  console.log('   - 用户: 5 条');
  console.log('   - 权限包: 5 条');
  console.log('   - 临时权限申请: 4 条 (覆盖所有状态)');
  console.log('');
  console.log('🚀 启动服务: npm start');
  console.log('🧪 运行测试: npm test');
});

db.close();
