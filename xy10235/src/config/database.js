const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/animal-cage.db');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      }
    });
    
    dbInstance.run('PRAGMA journal_mode = WAL');
    dbInstance.run('PRAGMA foreign_keys = ON');
  }
  return dbInstance;
}

function closeDB() {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        console.error('关闭数据库失败:', err.message);
      }
    });
    dbInstance = null;
  }
}

module.exports = {
  getDB,
  closeDB
};
