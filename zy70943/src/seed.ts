import bcrypt from 'bcryptjs';
import db from './config/database';
import { nowTimestamp } from './utils/helpers';

function seedUsers() {
  const users = [
    { username: 'admin', password: '123456', real_name: '系统管理员', role: 'admin' },
    { username: 'operator1', password: '123456', real_name: '调度员张三', role: 'operator' },
    { username: 'operator2', password: '123456', real_name: '调度员李四', role: 'operator' },
    { username: 'auditor1', password: '123456', real_name: '审计员王五', role: 'auditor' },
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, real_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = nowTimestamp();

  for (const user of users) {
    const passwordHash = bcrypt.hashSync(user.password, 10);
    insertUser.run(user.username, passwordHash, user.real_name, user.role, now, now);
  }

  console.log('用户数据初始化完成');
}

function seedDemoData() {
  const now = nowTimestamp();

  const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
  if (!adminUser) return;

  console.log('已存在测试数据，跳过初始化');
}

try {
  seedUsers();
  seedDemoData();
  console.log('数据初始化完成');
  process.exit(0);
} catch (err) {
  console.error('数据初始化失败:', err);
  process.exit(1);
}
