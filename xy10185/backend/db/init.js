const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'portal.db');
const schemaPath = path.join(__dirname, 'schema.sql');

let dbInstance = null;

async function initDatabase() {
  if (dbInstance) return dbInstance;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }
  
  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.run(schema);
    saveDatabase();
    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
    throw err;
  }
  
  return dbInstance;
}

function saveDatabase() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDatabase() {
  return dbInstance;
}

module.exports = {
  initDatabase,
  saveDatabase,
  getDatabase,
  dbPath
};