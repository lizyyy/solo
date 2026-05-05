const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/pharmacy.db');
const dataDir = path.dirname(dbPath);

let db = null;
let isInitialized = false;

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const normalizeParams = (params) => {
  return params.map(param => param === undefined ? null : param);
};

const execSql = (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  const normalizedParams = normalizeParams(params);
  const stmt = db.prepare(sql);
  try {
    if (normalizedParams.length > 0) {
      stmt.bind(normalizedParams);
    }
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    
    return results;
  } finally {
    stmt.free();
  }
};

const runSql = (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  const normalizedParams = normalizeParams(params);
  const stmt = db.prepare(sql);
  try {
    if (normalizedParams.length > 0) {
      stmt.bind(normalizedParams);
    }
    
    stmt.step();
    
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    let lastInsertRowid = null;
    try {
      if (idStmt.step()) {
        const row = idStmt.getAsObject();
        lastInsertRowid = row ? row.id : null;
      }
    } finally {
      idStmt.free();
    }
    
    return {
      changes: db.getRowsModified(),
      lastInsertRowid
    };
  } finally {
    stmt.free();
  }
};

const getOne = (sql, params = []) => {
  const results = execSql(sql, params);
  return results.length > 0 ? results[0] : undefined;
};

const getAll = (sql, params = []) => {
  return execSql(sql, params);
};

const initDatabase = async () => {
  if (isInitialized && db) {
    return db;
  }

  ensureDataDir();

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  isInitialized = true;
  return db;
};

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  execSql,
  runSql,
  getOne,
  getAll
};
