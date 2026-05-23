const { sequelize } = require('../models');
const logger = require('../config/logger');

async function initDatabase() {
  try {
    logger.info('开始初始化数据库...');
    
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    logger.info('数据库表同步完成');
    
    logger.info('数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
