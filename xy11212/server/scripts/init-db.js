const { initDB } = require('../config/database');

async function main() {
  try {
    await initDB();
    console.log('数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

main();
