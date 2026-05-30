const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { createTables } = require('./schema');

let dbInstance = null;

class DatabaseWrapper {
  constructor(db) {
    this.db = db;
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  pragma(sql) {
    return new Promise((resolve, reject) => {
      this.db.run(`PRAGMA ${sql}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params) => {
        return new Promise((resolve, reject) => {
          stmt.run(...params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
          });
        });
      },
      get: (...params) => {
        return new Promise((resolve, reject) => {
          stmt.get(...params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      },
      all: (...params) => {
        return new Promise((resolve, reject) => {
          stmt.all(...params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      }
    };
  }

  run(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, ...params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }

  get(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, ...params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, ...params) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, ...params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  transaction(fn) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.run('BEGIN TRANSACTION');
        await fn();
        await this.run('COMMIT');
        resolve();
      } catch (err) {
        await this.run('ROLLBACK');
        reject(err);
      }
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

const initDatabase = async () => {
  const dbDir = path.dirname(config.database.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(config.database.path);
  const wrappedDb = new DatabaseWrapper(db);

  await wrappedDb.pragma(`journal_mode = ${config.database.journalMode}`);
  await wrappedDb.pragma('foreign_keys = ON');

  await createTables(wrappedDb);

  return wrappedDb;
};

const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await initDatabase();
  }
  return dbInstance;
};

const getDbSync = () => {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call getDb() first.');
  }
  return dbInstance;
};

const closeDb = async () => {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
};

module.exports = {
  getDb,
  getDbSync,
  closeDb,
  initDatabase,
  DatabaseWrapper
};
