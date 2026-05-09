const sqlite3 = require('sqlite3').verbose();
const config = require('../config');
const { TABLES, INDEXES } = require('./schema');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    const dbDir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(config.DB_PATH);
    this.db.serialize(() => {
      this.db.run('PRAGMA foreign_keys = ON');
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA synchronous = NORMAL');
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  allPaged(sql, params = [], page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const countSql = sql.replace(/^SELECT .*? FROM/, 'SELECT COUNT(*) as total FROM').split('ORDER BY')[0];
    
    return new Promise((resolve, reject) => {
      this.db.get(countSql, params, (err, countRow) => {
        if (err) return reject(err);
        
        const pagedSql = `${sql} LIMIT ? OFFSET ?`;
        const pagedParams = [...params, pageSize, offset];
        
        this.db.all(pagedSql, pagedParams, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              items: rows,
              total: countRow.total,
              page,
              pageSize,
              totalPages: Math.ceil(countRow.total / pageSize)
            });
          }
        });
      });
    });
  }

  beginTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  commit() {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  rollback() {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async transaction(fn) {
    try {
      await this.beginTransaction();
      const result = await fn(this);
      await this.commit();
      return result;
    } catch (err) {
      await this.rollback();
      throw err;
    }
  }

  async initialize() {
    for (const [name, sql] of Object.entries(TABLES)) {
      await this.run(sql);
      console.log(`Table ${name} ready`);
    }
    
    for (const indexSql of INDEXES) {
      await this.run(indexSql);
    }
    
    const defaultUsers = [
      { id: 'u1', username: 'admin', display_name: '管理员', role: 'admin' },
      { id: 'u2', username: 'operator1', display_name: '客服小王', role: 'operator' },
      { id: 'u3', username: 'operator2', display_name: '客服小李', role: 'operator' }
    ];
    
    const now = Date.now();
    for (const user of defaultUsers) {
      const existing = await this.get('SELECT id FROM users WHERE username = ?', [user.username]);
      if (!existing) {
        await this.run(
          'INSERT INTO users (id, username, display_name, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
          [user.id, user.username, user.display_name, user.role, now]
        );
      }
    }
    
    console.log('Database initialized successfully');
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

module.exports = new Database();
