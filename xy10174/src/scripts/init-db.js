const fs = require('fs');
const path = require('path');
const { runMigrations, closeConnection } = require('../db/knex');

const dataDir = path.join(__dirname, '../../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function main() {
  console.log('开始初始化数据库...');
  
  try {
    await runMigrations();
    console.log('数据库初始化完成！');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
