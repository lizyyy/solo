const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/knowledge_base.db');

let db;
let initPromise;

function initDatabase() {
  if (initPromise) return initPromise;
  
  initPromise = new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
      } else {
        console.log('已连接到SQLite数据库');
        initTables().then(resolve).catch(reject);
      }
    });
  });
  
  return initPromise;
}

function initTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const tables = [
        `CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY,
          article_no TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          team TEXT NOT NULL,
          author TEXT,
          valid_until DATE NOT NULL,
          status TEXT DEFAULT 'active',
          citation_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS review_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_no TEXT NOT NULL,
          reviewer TEXT,
          review_opinion TEXT,
          review_status TEXT DEFAULT 'pending',
          suggested_valid_until DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (article_no) REFERENCES articles(article_no)
        )`,
        `CREATE TABLE IF NOT EXISTS citation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_no TEXT NOT NULL,
          cited_by TEXT,
          cited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (article_no) REFERENCES articles(article_no)
        )`,
        `CREATE TABLE IF NOT EXISTS exception_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_path TEXT,
          original_input TEXT,
          error_message TEXT,
          processing_basis TEXT,
          occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS reminder_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_type TEXT NOT NULL,
          report_date DATE NOT NULL,
          content TEXT NOT NULL,
          generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      let completed = 0;
      tables.forEach(sql => {
        db.run(sql, (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === tables.length) {
            console.log('数据库表初始化完成');
            resolve();
          }
        });
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return db;
}

module.exports = {
  initDatabase,
  getDb
};
