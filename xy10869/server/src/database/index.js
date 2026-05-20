const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/database.db');
const dataDir = path.join(__dirname, '../../data');
const logsDir = path.join(__dirname, '../../logs');

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('已创建数据目录:', dataDir);
  }
} catch (err) {
  console.warn('创建数据目录失败（可能已存在或权限问题）:', err.message);
}

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('已创建日志目录:', logsDir);
  }
} catch (err) {
  console.warn('创建日志目录失败（可能已存在或权限问题）:', err.message);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    console.error('请确保 data 目录存在且有写入权限');
  } else {
    console.log('已连接到 SQLite 数据库');
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('开启外键约束失败:', err.message);
      } else {
        console.log('已开启 SQLite 外键约束');
      }
    });
  }
});

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = { db, run, get, all };
