const { sequelize } = require('../src/models');

async function initDatabase() {
  try {
    console.log('开始初始化数据库...');
    await sequelize.sync({ force: true });
    console.log('数据库表创建成功！');
    console.log('数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
