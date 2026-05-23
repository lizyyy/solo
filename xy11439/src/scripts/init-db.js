const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');

const db = getDatabase();

const users = [
  {
    id: uuidv4(),
    username: 'admin',
    role: config.roles.ADMIN,
    name: '系统管理员',
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  },
  {
    id: uuidv4(),
    username: 'manager1',
    role: config.roles.MANAGER,
    name: '张店长',
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  },
  {
    id: uuidv4(),
    username: 'supervisor1',
    role: config.roles.SUPERVISOR,
    name: '李主管',
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  },
  {
    id: uuidv4(),
    username: 'staff1',
    role: config.roles.STAFF,
    name: '王保洁',
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  },
  {
    id: uuidv4(),
    username: 'auditor1',
    role: config.roles.AUDITOR,
    name: '赵审计',
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, username, role, name, created_at, updated_at)
  VALUES (@id, @username, @role, @name, @created_at, @updated_at)
`);

const insertMany = db.transaction((items) => {
  for (const item of items) {
    insertUser.run(item);
  }
});

insertMany(users);

console.log('数据库初始化完成');
console.log('已创建用户:');
users.forEach(u => console.log(`  - ${u.name} (${u.username}, 角色: ${u.role})`));

process.exit(0);
