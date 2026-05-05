const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/network-lab.db');
const dataDir = path.dirname(dbPath);

let db = null;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('已连接到 SQLite 数据库:', dbPath);
      resolve();
    });

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS experiments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          protocol TEXT NOT NULL,
          config TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'created',
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          statistics TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          experiment_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL,
          source TEXT,
          target TEXT,
          payload TEXT,
          details TEXT,
          FOREIGN KEY (experiment_id) REFERENCES experiments (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY,
          experiment_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          state TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_activity_at TEXT,
          FOREIGN KEY (experiment_id) REFERENCES experiments (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS packets (
          id TEXT PRIMARY KEY,
          experiment_id TEXT NOT NULL,
          connection_id TEXT,
          timestamp TEXT NOT NULL,
          direction TEXT NOT NULL,
          type TEXT NOT NULL,
          payload TEXT,
          size INTEGER,
          FOREIGN KEY (experiment_id) REFERENCES experiments (id),
          FOREIGN KEY (connection_id) REFERENCES connections (id)
        )
      `);
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all
};
