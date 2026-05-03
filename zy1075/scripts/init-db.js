require('dotenv').config();
const models = require('../src/models');

async function initDatabase() {
  try {
    console.log('正在初始化数据库...');
    
    await models.sequelize.authenticate();
    console.log('数据库连接成功。');
    
    await models.sequelize.sync({ force: process.env.NODE_ENV === 'development' });
    console.log('数据库模型同步完成。');
    
    console.log('数据库初始化成功！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
