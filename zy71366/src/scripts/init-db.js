const db = require('../database/connection');
const { createTables } = require('../database/schema');
const fs = require('fs-extra');
const config = require('../config');

async function initDatabase() {
  try {
    console.log('正在初始化存储目录...');
    await fs.ensureDir(config.storage.lutDir);
    await fs.ensureDir(config.storage.archiveDir);
    await fs.ensureDir(config.storage.exportDir);
    await fs.ensureDir(config.storage.tempDir);
    console.log('存储目录创建完成');

    console.log('正在连接数据库...');
    await db.connect();
    console.log('数据库连接成功');

    console.log('正在创建数据表...');
    const statements = createTables.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt + ';');
      }
    }
    console.log('数据表创建完成');

    console.log('\n初始化完成！');
    console.log('数据库路径:', config.database.path);
    console.log('LUT存储目录:', config.storage.lutDir);

    await db.close();
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
