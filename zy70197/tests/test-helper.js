const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let testDb = null;

function setupTestDatabase() {
  const testDbPath = path.join(__dirname, 'test_database.db');
  
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (e) {
    console.log('清理测试数据库失败:', e.message);
  }
  
  testDb = new Database(testDbPath);
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS agreements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      reserved_amount REAL NOT NULL DEFAULT 0,
      used_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, year)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agreement_id TEXT NOT NULL,
      reserved_amount REAL NOT NULL DEFAULT 0,
      used_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agreement_id) REFERENCES agreements(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agreement_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      released_at DATETIME,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (agreement_id) REFERENCES agreements(id)
    );

    CREATE TABLE IF NOT EXISTS amount_records (
      id TEXT PRIMARY KEY,
      agreement_id TEXT NOT NULL,
      project_id TEXT,
      order_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agreement_id) REFERENCES agreements(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_project ON orders(project_id);
    CREATE INDEX IF NOT EXISTS idx_amount_records_agreement ON amount_records(agreement_id);
    CREATE INDEX IF NOT EXISTS idx_amount_records_project ON amount_records(project_id);
  `);
  
  return testDb;
}

function getTestDb() {
  return testDb;
}

function teardownTestDatabase() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
  
  const testDbPath = path.join(__dirname, 'test_database.db');
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (e) {
    console.log('清理测试数据库失败:', e.message);
  }
}

module.exports = {
  setupTestDatabase,
  getTestDb,
  teardownTestDatabase
};
