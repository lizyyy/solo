const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const SCHEMA_VERSION = 1;

let dbInstance = null;
let dbPath = null;

const db = {
  prepare: function(sql) {
    return {
      run: function(...params) {
        dbInstance.run(sql, params);
        saveDatabase();
        return { 
          lastInsertRowid: getLastInsertId(),
          changes: dbInstance.getRowsModified()
        };
      },
      get: function(...params) {
        const results = dbInstance.exec(sql, params);
        if (results.length === 0 || results[0].values.length === 0) {
          return undefined;
        }
        const columns = results[0].columns;
        const values = results[0].values[0];
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      },
      all: function(...params) {
        const results = dbInstance.exec(sql, params);
        if (results.length === 0) {
          return [];
        }
        const columns = results[0].columns;
        return results[0].values.map(row => {
          const obj = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      }
    };
  },
  exec: function(sql) {
    dbInstance.run(sql);
    saveDatabase();
  },
  transaction: function(fn) {
    dbInstance.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      dbInstance.run('COMMIT');
      saveDatabase();
      return result;
    } catch (e) {
      dbInstance.run('ROLLBACK');
      throw e;
    }
  }
};

function getLastInsertId() {
  const result = dbInstance.exec("SELECT last_insert_rowid() as id");
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return 0;
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  dbPath = path.join(__dirname, '..', 'data', 'procurement.db');
  const dataDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
    console.log('数据库加载成功');
  } else {
    dbInstance = new SQL.Database();
    console.log('新数据库创建成功');
  }

  createTables();
  
  console.log('数据库初始化完成');
}

function createTables() {
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}',
      schema_version INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      last_edited_by TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS draft_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id TEXT NOT NULL,
      data TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      version INTEGER NOT NULL,
      session_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id TEXT,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      submitter TEXT DEFAULT '系统管理员'
    )
  `);

  saveDatabase();
}

function saveDatabase() {
  if (dbInstance && dbPath) {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getSchemaVersion() {
  return SCHEMA_VERSION;
}

function migrateDraftData(data, fromVersion) {
  if (fromVersion >= SCHEMA_VERSION) return data;
  
  let migrated = { ...data };
  
  if (fromVersion < 1) {
    migrated = {
      applicationInfo: migrated.applicationInfo || {},
      supplierComparison: migrated.supplierComparison || [],
      budgetItems: migrated.budgetItems || [],
      attachments: migrated.attachments || []
    };
  }
  
  return migrated;
}

module.exports = {
  db,
  initDatabase,
  getSchemaVersion,
  migrateDraftData,
  saveDatabase
};
