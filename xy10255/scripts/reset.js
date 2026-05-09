const fs = require('fs');
const path = require('path');

const DB_DATA_PATH = path.join(__dirname, '..', 'data', 'app.db.json');

if (fs.existsSync(DB_DATA_PATH)) {
  fs.unlinkSync(DB_DATA_PATH);
  console.log('数据库已重置');
} else {
  console.log('数据库文件不存在，无需重置');
}
