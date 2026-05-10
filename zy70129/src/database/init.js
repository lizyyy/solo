const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/deposit-service.db');

function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function initDatabase() {
  ensureDataDir();
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  db.exec(schema);
  
  console.log('数据库初始化完成');
  return db;
}

function getDatabase() {
  if (!global.__dbInstance) {
    global.__dbInstance = initDatabase();
  }
  return global.__dbInstance;
}

function closeDatabase() {
  if (global.__dbInstance) {
    global.__dbInstance.close();
    global.__dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  DB_PATH
};
