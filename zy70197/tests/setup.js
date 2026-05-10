const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_database.db');

try {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
} catch (e) {
  console.log('清理测试数据库失败:', e.message);
}

process.env.DB_PATH = testDbPath;
