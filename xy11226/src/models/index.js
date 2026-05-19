const sequelize = require('../config/database');

const Role = require('./Role');
const User = require('./User');
const Ticket = require('./Ticket');
const AuditLog = require('./AuditLog');

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据库表同步完成');
    
    await initDefaultData();
    console.log('默认数据初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
};

const initDefaultData = async () => {
  const roleCount = await Role.count();
  if (roleCount === 0) {
    await Role.bulkCreate([
      {
        name: 'admin',
        description: '系统管理员',
        permissions: ['ticket:create', 'ticket:read', 'ticket:update', 'ticket:delete', 'ticket:classify', 'ticket:review', 'ticket:export', 'user:create', 'user:read', 'user:update', 'user:delete', 'audit:read']
      },
      {
        name: 'operator',
        description: '值班员',
        permissions: ['ticket:create', 'ticket:read', 'ticket:update', 'ticket:classify', 'ticket:review', 'ticket:export']
      },
      {
        name: 'viewer',
        description: '查看员',
        permissions: ['ticket:read', 'ticket:export']
      }
    ]);
  }

  const userCount = await User.count();
  if (userCount === 0) {
    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    const operatorRole = await Role.findOne({ where: { name: 'operator' } });
    
    await User.bulkCreate([
      {
        username: 'admin',
        realName: '系统管理员',
        phone: '13800138000',
        roleId: adminRole.id
      },
      {
        username: 'operator1',
        realName: '张三',
        phone: '13900139001',
        roleId: operatorRole.id
      },
      {
        username: 'operator2',
        realName: '李四',
        phone: '13900139002',
        roleId: operatorRole.id
      }
    ]);
  }
};

module.exports = {
  sequelize,
  initDatabase,
  Role,
  User,
  Ticket,
  AuditLog
};
