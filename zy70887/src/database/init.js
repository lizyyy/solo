const sqlite3 = require('sqlite3').verbose();
const SCHEMA = require('./schema');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/legal_stamping.db');
const fs = require('fs');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到SQLite数据库');
});

db.serialize(() => {
  console.log('开始创建数据库表...');
  db.exec(SCHEMA, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
      process.exit(1);
    }
    console.log('数据库表创建完成');

    console.log('插入初始数据...');
    
    const insertUsers = `
      INSERT OR IGNORE INTO users (username, role, department) VALUES
      ('assistant1', 'assistant', '法务部'),
      ('reviewer1', 'reviewer', '法务部'),
      ('admin1', 'admin', '法务部'),
      ('courier1', 'courier', '行政部')
    `;
    
    db.run(insertUsers, (err) => {
      if (err) {
        console.error('插入用户数据失败:', err.message);
      } else {
        console.log('初始用户数据插入完成');
      }
    });

    const insertPermissions = `
      INSERT OR IGNORE INTO permissions (user_id, permission_type, granted_by) VALUES
      (1, 'stamp_authorized', 3),
      (1, 'stamp_attachment', 3),
      (1, 'resubmit', 3),
      (2, 'export', 3),
      (4, 'courier_send', 3)
    `;
    
    db.run(insertPermissions, (err) => {
      if (err) {
        console.error('插入权限数据失败:', err.message);
      } else {
        console.log('初始权限数据插入完成');
      }
    });

    console.log('数据库初始化完成！');
    console.log('数据库位置:', dbPath);
  });
});

setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('数据库连接已关闭');
  });
}, 2000);
