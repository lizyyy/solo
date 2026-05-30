const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function init() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '../data/isrc.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err);
        reject(err);
        return;
      }
      console.log('数据库连接成功');
      createTables().then(resolve).catch(reject);
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          source TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS tracks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id INTEGER NOT NULL,
          isrc TEXT,
          track_name TEXT NOT NULL,
          artist TEXT,
          lyricist TEXT,
          composer TEXT,
          platform_version TEXT,
          duration TEXT,
          status TEXT DEFAULT 'pending',
          issues TEXT,
          notes TEXT,
          source_row INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          track_id INTEGER,
          batch_id INTEGER,
          operation TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          operator TEXT DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (track_id) REFERENCES tracks(id),
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS isrc_registry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          isrc TEXT UNIQUE NOT NULL,
          track_name TEXT,
          artist TEXT,
          registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function prepare(sql) {
  return {
    run: async (...params) => {
      const result = await run(sql, params);
      return result;
    },
    get: async (...params) => {
      return await get(sql, params);
    },
    all: async (...params) => {
      return await all(sql, params);
    }
  };
}

function getDB() {
  return { run, get, all, prepare };
}

module.exports = { init, getDB };
