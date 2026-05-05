const fs = require('fs');
const path = require('path');
const SCHEMA = require('../database/schema');
const { run, closeDatabase } = require('../database/database');

const dataDir = path.join(__dirname, '../../data');

async function initializeDatabase() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('创建数据目录:', dataDir);
    }

    console.log('开始初始化数据库...');

    for (const [tableName, createSql] of Object.entries(SCHEMA)) {
      console.log(`创建表: ${tableName}`);
      await run(createSql);
      console.log(`✓ 表 ${tableName} 创建成功`);
    }

    console.log('');
    console.log('数据库初始化完成！');
    console.log('');
    console.log('创建的表:');
    console.log('- artworks (作品表)');
    console.log('- layers (漆层表)');
    console.log('- processes (工序表)');
    console.log('- wetroom_readings (湿房读数表)');
    console.log('- reviews (复核表)');
    console.log('- handover_notes (交接备注表)');
    console.log('- violations (违规记录表)');

    closeDatabase();
  } catch (err) {
    console.error('初始化数据库失败:', err.message);
    process.exit(1);
  }
}

initializeDatabase();
