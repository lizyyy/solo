const fs = require('fs');
const path = require('path');
const pool = require('../src/database/pool');
const logger = require('../src/utils/logger');

async function initDatabase() {
  try {
    const client = await pool.connect();
    
    logger.info('正在初始化数据库...');
    
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schemaSQL);
    
    logger.info('数据库初始化完成！');
    
    client.release();
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败', { error: error.message });
    process.exit(1);
  }
}

initDatabase();
