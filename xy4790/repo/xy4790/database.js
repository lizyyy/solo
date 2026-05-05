const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tool-cabinet.db');

let dbInstance = null;
let dbSaveTimer = null;

function saveDatabase() {
  if (dbInstance) {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function scheduleSave() {
  if (dbSaveTimer) {
    clearTimeout(dbSaveTimer);
  }
  dbSaveTimer = setTimeout(saveDatabase, 100);
}

class Statement {
  constructor(stmt, sqlDb) {
    this.stmt = stmt;
    this.sqlDb = sqlDb;
  }

  run(...params) {
    this.stmt.bind(params);
    this.stmt.step();
    this.stmt.reset();
    scheduleSave();
    const lastIdResult = this.sqlDb.exec("SELECT last_insert_rowid() as id");
    return {
      changes: this.getRowsModified(),
      lastInsertRowid: lastIdResult[0]?.values[0]?.[0]
    };
  }

  get(...params) {
    this.stmt.bind(params);
    if (this.stmt.step()) {
      const row = this.stmt.getAsObject();
      this.stmt.reset();
      return row;
    }
    this.stmt.reset();
    return undefined;
  }

  all(...params) {
    const results = [];
    this.stmt.bind(params);
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return results;
  }

  free() {
    this.stmt.free();
  }

  getRowsModified() {
    const result = this.sqlDb.exec("SELECT changes() as count");
    return result[0]?.values[0]?.[0] || 0;
  }
}

class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
  }

  exec(sql) {
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        this.sqlDb.run(stmt);
      }
    }
    scheduleSave();
  }

  prepare(sql) {
    const stmt = this.sqlDb.prepare(sql);
    return new Statement(stmt, this.sqlDb);
  }

  transaction(fn) {
    this.sqlDb.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.sqlDb.run('COMMIT');
      scheduleSave();
      return result;
    } catch (error) {
      this.sqlDb.run('ROLLBACK');
      throw error;
    }
  }

  export() {
    return this.sqlDb.export();
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  let existingDb = null;
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      existingDb = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('读取现有数据库失败，创建新数据库:', e.message);
      existingDb = new SQL.Database();
    }
  } else {
    existingDb = new SQL.Database();
  }

  const db = new DatabaseWrapper(existingDb);

  db.exec(`
CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS borrow_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  borrowed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at DATETIME,
  status TEXT NOT NULL DEFAULT 'BORROWED',
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS repair_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  reporter_id INTEGER NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (reporter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

  const initTools = [
    { name: '螺丝刀套装' },
    { name: '活动扳手' },
    { name: '电钻' },
    { name: '锤子' },
    { name: '卷尺' },
    { name: '万用表' },
    { name: '梯子' },
    { name: '手推车' }
  ];

  const initUsers = [
    { name: '张三', phone: '13800138001' },
    { name: '李四', phone: '13800138002' },
    { name: '王五', phone: '13800138003' }
  ];

  const toolCountStmt = db.prepare('SELECT COUNT(*) as count FROM tools');
  const toolCountResult = toolCountStmt.get();
  const toolCount = toolCountResult ? toolCountResult.count : 0;

  if (toolCount === 0) {
    const insertTool = db.prepare('INSERT INTO tools (name, status, version) VALUES (?, ?, 1)');
    const insertUser = db.prepare('INSERT INTO users (name, phone) VALUES (?, ?)');
    
    for (const tool of initTools) {
      insertTool.run(tool.name, 'AVAILABLE');
    }
    
    for (const user of initUsers) {
      insertUser.run(user.name, user.phone);
    }
    
    saveDatabase();
  }

  process.on('exit', () => {
    saveDatabase();
  });

  process.on('SIGINT', () => {
    saveDatabase();
    process.exit();
  });

  dbInstance = db;
  return db;
}

const dbReady = initDatabase();

function getDb() {
  if (!dbInstance) {
    throw new Error('数据库未初始化');
  }
  return dbInstance;
}

module.exports = {
  ready: dbReady,
  getDb,
  exec: (...args) => getDb().exec(...args),
  prepare: (...args) => getDb().prepare(...args),
  transaction: (...args) => getDb().transaction(...args)
};
