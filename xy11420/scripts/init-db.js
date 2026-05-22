const bcrypt = require('bcryptjs');
const { initDb, run, get } = require('../src/db');
const { initSchema } = require('../src/db/schema');

const defaultUsers = [
  {
    username: 'entry_user',
    password: 'entry123',
    role: 'entry',
    real_name: '录入员小张'
  },
  {
    username: 'reviewer_user',
    password: 'reviewer123',
    role: 'reviewer',
    real_name: '复核员小李'
  },
  {
    username: 'manager_user',
    password: 'manager123',
    role: 'manager',
    real_name: '主管老王'
  },
  {
    username: 'readonly_user',
    password: 'readonly123',
    role: 'readonly',
    real_name: '只读用户'
  }
];

function initUsers() {
  console.log('开始初始化默认用户...');
  
  for (const user of defaultUsers) {
    const existing = get('SELECT id FROM users WHERE username = ?', [user.username]);
    if (existing) {
      console.log(`用户 ${user.username} 已存在，跳过`);
      continue;
    }
    
    const passwordHash = bcrypt.hashSync(user.password, 10);
    run(
      'INSERT INTO users (username, password_hash, role, real_name) VALUES (?, ?, ?, ?)',
      [user.username, passwordHash, user.role, user.real_name]
    );
    console.log(`用户 ${user.username} 创建成功 (密码: ${user.password})`);
  }
}

async function main() {
  try {
    await initDb();
    initSchema();
    initUsers();
    console.log('\n数据库初始化完成!');
    console.log('默认账号:');
    defaultUsers.forEach(u => {
      console.log(`  ${u.role.padEnd(10)} - ${u.username} / ${u.password} (${u.real_name})`);
    });
  } catch (err) {
    console.error('初始化失败:', err);
    process.exit(1);
  }
}

main();
