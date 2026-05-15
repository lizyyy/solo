const fs = require('fs');
const path = require('path');
const { createTables } = require('../models/initTables');
const { seedAll } = require('./seedData');

const dataDir = path.join(__dirname, '../../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function initAll() {
  try {
    await createTables();
    console.log('数据库表创建完成');
    await seedAll();
    console.log('\n=== 数据库初始化完成 ===');
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

initAll();