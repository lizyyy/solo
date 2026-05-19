const db = require('../src/database');
const logger = require('../src/utils/logger');

const initDatabase = async () => {
  try {
    logger.info('开始初始化数据库...');
    await db.initTables();
    logger.info('数据库表创建完成');
    await db.closeConnection();
    logger.info('数据库初始化完成！');
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

initDatabase();