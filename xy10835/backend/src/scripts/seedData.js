const { initDatabase } = require('../database/schema');
const { UserDAO, OperationEventDAO } = require('../database/dao');
const moment = require('moment');

const users = [
  { username: 'zhangsan', name: '张三', role: 'operator', department: '合规部' },
  { username: 'lisi', name: '李四', role: 'operator', department: '合规部' },
  { username: 'wangwu', name: '王五', role: 'operator', department: '技术部' },
  { username: 'zhaoliu', name: '赵六', role: 'auditor', department: '审计部' },
  { username: 'admin', name: '系统管理员', role: 'admin', department: '运维部' }
];

const eventTypes = ['login', 'logout', 'create', 'update', 'delete', 'view', 'export', 'approve', 'reject'];
const modules = ['用户管理', '角色管理', '权限配置', '日志查询', '报表导出', '系统设置', '数据备份', '审批流程'];
const statuses = ['success', 'failed', 'warning'];
const ipAddresses = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.50', '172.16.0.1'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDetails(eventType, module) {
  const detailsMap = {
    login: `用户登录系统，访问模块: ${module}`,
    logout: '用户退出系统',
    create: `创建新记录 - 模块: ${module}`,
    update: `更新记录信息 - 模块: ${module}`,
    delete: `删除记录 - 模块: ${module}`,
    view: `查看数据列表 - 模块: ${module}`,
    export: `导出数据报表 - 模块: ${module}`,
    approve: '审批通过操作',
    reject: '审批拒绝操作'
  };
  return detailsMap[eventType] || `执行${eventType}操作`;
}

async function seedData() {
  console.log('开始初始化数据...');
  
  await initDatabase();
  console.log('数据库初始化完成');

  console.log('创建用户数据...');
  const createdUsers = [];
  for (const user of users) {
    const existing = await UserDAO.getByUsername(user.username);
    if (!existing) {
      const created = await UserDAO.create(user);
      createdUsers.push(created);
      console.log(`  创建用户: ${user.name}`);
    } else {
      createdUsers.push(existing);
      console.log(`  用户已存在: ${user.name}`);
    }
  }

  console.log('生成操作日志数据...');
  const now = moment();
  const eventCount = 200;

  for (let i = 0; i < eventCount; i++) {
    const user = randomItem(createdUsers);
    const eventType = randomItem(eventTypes);
    const module = randomItem(modules);
    const status = randomItem(statuses);
    const ip = randomItem(ipAddresses);
    
    const eventTime = now.clone().subtract(Math.floor(Math.random() * 30), 'days').subtract(Math.floor(Math.random() * 24), 'hours').toISOString();

    await OperationEventDAO.create({
      event_type: eventType,
      module: module,
      operator_id: user.id,
      operator_name: user.name,
      ip_address: ip,
      details: generateDetails(eventType, module),
      status: status,
      created_at: eventTime
    });

    if ((i + 1) % 50 === 0) {
      console.log(`  已生成 ${i + 1} 条操作日志`);
    }
  }

  console.log('\n数据初始化完成！');
  console.log(`用户数: ${createdUsers.length}`);
  console.log(`操作日志数: ${eventCount}`);
  console.log('\n用户列表:');
  createdUsers.forEach(u => {
    console.log(`  ${u.name} (${u.username}) - ID: ${u.id}`);
  });
}

seedData().catch(error => {
  console.error('数据初始化失败:', error);
  process.exit(1);
});
