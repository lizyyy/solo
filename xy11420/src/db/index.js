const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/prep-status.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

async function initDb() {
  if (db) return db;
  
  SQL = await initSqlJs();
  
  let fileBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    fileBuffer = fs.readFileSync(DB_PATH);
  }
  
  db = new SQL.Database(fileBuffer);
  
  db.run('PRAGMA foreign_keys = ON');
  
  console.log('数据库连接成功:', DB_PATH);
  
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

setInterval(() => {
  saveDb();
}, 5000);

process.on('exit', () => {
  saveDb();
  console.log('数据库已保存');
});

process.on('SIGINT', () => {
  saveDb();
  process.exit(0);
});

function escapeValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  return value;
}

function run(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  
  let formattedSql = sql;
  if (Array.isArray(params) && params.length > 0) {
    let paramIndex = 0;
    formattedSql = sql.replace(/\?/g, () => {
      const value = params[paramIndex++];
      return escapeValue(value);
    });
  }
  
  const isInsert = /^\s*INSERT\s+/i.test(formattedSql);
  let tableName = null;
  if (isInsert) {
    const match = formattedSql.match(/INSERT\s+INTO\s+(\w+)/i);
    if (match) tableName = match[1];
  }
  
  let maxIdBefore = 0;
  if (tableName) {
    try {
      const maxResult = db.exec(`SELECT MAX(id) as max_id FROM ${tableName}`);
      if (maxResult[0] && maxResult[0].values[0] && maxResult[0].values[0][0]) {
        maxIdBefore = maxResult[0].values[0][0];
      }
    } catch (e) {}
  }
  
  db.run(formattedSql);
  saveDb();
  
  let lastID = 0;
  let changes = 1;
  
  if (tableName) {
    try {
      const maxResult = db.exec(`SELECT MAX(id) as max_id FROM ${tableName}`);
      if (maxResult[0] && maxResult[0].values[0] && maxResult[0].values[0][0]) {
        const maxIdAfter = maxResult[0].values[0][0];
        if (maxIdAfter > maxIdBefore) {
          lastID = maxIdAfter;
        }
      }
    } catch (e) {}
  }
  
  return { lastID, changes };
}

function get(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  
  let formattedSql = sql;
  if (Array.isArray(params) && params.length > 0) {
    let paramIndex = 0;
    formattedSql = sql.replace(/\?/g, () => {
      const value = params[paramIndex++];
      return escapeValue(value);
    });
  }
  
  const result = db.exec(formattedSql);
  
  if (!result || result.length === 0) return null;
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  if (values.length === 0) return null;
  
  const row = {};
  columns.forEach((col, i) => {
    row[col] = values[0][i];
  });
  
  return row;
}

function all(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  
  let formattedSql = sql;
  if (Array.isArray(params) && params.length > 0) {
    let paramIndex = 0;
    formattedSql = sql.replace(/\?/g, () => {
      const value = params[paramIndex++];
      return escapeValue(value);
    });
  }
  
  const result = db.exec(formattedSql);
  
  if (!result || result.length === 0) return [];
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function prepare(sql) {
  if (!db) throw new Error('数据库未初始化');
  return db.prepare(sql);
}

function transaction(operations) {
  if (!db) throw new Error('数据库未初始化');
  
  db.run('BEGIN TRANSACTION');
  try {
    for (const op of operations) {
      let formattedSql = op.sql;
      if (Array.isArray(op.params) && op.params.length > 0) {
        let paramIndex = 0;
        formattedSql = op.sql.replace(/\?/g, () => {
          const value = op.params[paramIndex++];
          return escapeValue(value);
        });
      }
      db.run(formattedSql);
    }
    db.run('COMMIT');
    saveDb();
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

module.exports = {
  initDb,
  run,
  get,
  all,
  prepare,
  transaction,
  saveDb,
  DB_PATH
};
