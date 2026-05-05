const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wwtp.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initTables();
  }

  initTables() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS data_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, type)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          analysis_data TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS remarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          time TEXT NOT NULL,
          original_reason TEXT,
          new_reason TEXT,
          operator TEXT,
          remark_data TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, type, time)
        )
      `);
    });
  }

  async saveData(type, date, data) {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(data);
      this.db.run(
        `INSERT OR REPLACE INTO data_records (date, type, data) VALUES (?, ?, ?)`,
        [date, type, jsonData],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getData(type, date) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT data FROM data_records WHERE date = ? AND type = ?`,
        [date, type],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? JSON.parse(row.data) : null);
        }
      );
    });
  }

  async saveAnalysis(date, analysis) {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(analysis);
      this.db.run(
        `INSERT OR REPLACE INTO analysis (date, analysis_data) VALUES (?, ?)`,
        [date, jsonData],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getAnalysis(date) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT analysis_data FROM analysis WHERE date = ?`,
        [date],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? JSON.parse(row.analysis_data) : null);
        }
      );
    });
  }

  async saveRemark(date, remark) {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(remark);
      this.db.run(
        `INSERT OR REPLACE INTO remarks (date, type, time, original_reason, new_reason, operator, remark_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [date, remark.type, remark.time, remark.originalReason, remark.newReason, remark.operator, jsonData],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getRemarks(date) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT remark_data FROM remarks WHERE date = ?`,
        [date],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => JSON.parse(row.remark_data)));
        }
      );
    });
  }

  async getAvailableDates() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT DISTINCT date FROM data_records ORDER BY date DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.date));
        }
      );
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = Database;
