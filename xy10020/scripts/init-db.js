require('dotenv').config();

const { initDatabase, getDb } = require('../src/database/client');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');

const initDatabaseData = () => {
  logger.info('开始初始化数据库数据...');

  const existingAdmin = User.findByUsername('admin');
  if (!existingAdmin) {
    const admin = User.create({
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    });
    logger.info('已创建管理员账户:', admin.username);
  } else {
    logger.info('管理员账户已存在');
  }

  const existingStreamer = User.findByUsername('streamer');
  if (!existingStreamer) {
    const streamer = User.create({
      username: 'streamer',
      password: 'streamer123',
      role: 'streamer'
    });
    logger.info('已创建主播账户:', streamer.username);
  } else {
    logger.info('主播账户已存在');
  }

  for (let i = 1; i <= 5; i++) {
    const username = `user${i}`;
    const existingUser = User.findByUsername(username);
    if (!existingUser) {
      const user = User.create({
        username,
        password: 'password123',
        role: 'user'
      });
      logger.info('已创建普通用户账户:', user.username);
    }
  }

  logger.info('数据库初始化完成！');
  logger.info('');
  logger.info('默认账户:');
  logger.info('  管理员: admin / admin123');
  logger.info('  主播: streamer / streamer123');
  logger.info('  普通用户: user1-user5 / password123');
};

const run = async () => {
  try {
    initDatabase();
    initDatabaseData();
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

run();
