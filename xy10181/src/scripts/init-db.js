require('dotenv').config();
const { initTables, initTriggers, initSampleData } = require('../models/dbInit');
const logger = require('../utils/logger');

const main = async () => {
  try {
    logger.info('开始初始化数据库...');
    
    await initTables();
    logger.info('数据库表初始化完成');
    
    await initTriggers();
    logger.info('触发器初始化完成');
    
    await initSampleData();
    logger.info('示例数据初始化完成');
    
    logger.info('数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

main();
