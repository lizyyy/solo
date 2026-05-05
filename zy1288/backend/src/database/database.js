const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'leads.db');

let db = null;

const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('已连接到 SQLite 数据库');
      
      db.serialize(() => {
        const createLeadsTable = `
          CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            course TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            responsible TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `;

        const createLeadHistoryTable = `
          CREATE TABLE IF NOT EXISTS lead_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
          )
        `;

        db.run(createLeadsTable);
        db.run(createLeadHistoryTable);
        
        db.all("PRAGMA table_info(leads)", (err, rows) => {
          if (err) {
            console.error('检查表结构失败:', err);
          } else {
            console.log('数据库表结构初始化完成');
          }
          resolve();
        });
      });
    });
  });
};

const getDb = () => {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

const STATUS_FLOW = {
  'new': ['contacting', 'cancelled'],
  'contacting': ['appointed', 'no_show', 'cancelled'],
  'appointed': ['attended', 'no_show', 'cancelled'],
  'attended': ['converted', 'not_interested'],
  'no_show': ['reappointed', 'lost'],
  'cancelled': ['reappointed', 'lost'],
  'converted': [],
  'not_interested': [],
  'lost': [],
  'reappointed': ['attended', 'no_show', 'cancelled']
};

const STATUS_LABELS = {
  'new': '新线索',
  'contacting': '联系中',
  'appointed': '已预约',
  'attended': '已参加',
  'no_show': '未到场',
  'cancelled': '已取消',
  'converted': '已转化',
  'not_interested': '无兴趣',
  'lost': '流失',
  'reappointed': '重新预约'
};

const COURSES = [
  'Python编程体验课',
  '少儿Scratch编程',
  'Web前端开发入门',
  '数据科学基础',
  '人工智能入门',
  '机器人编程',
  '游戏开发入门',
  '大数据技术基础'
];

const RESPONSIBLES = [
  '张顾问',
  '李顾问',
  '王顾问',
  '赵顾问',
  '刘顾问',
  '陈顾问',
  '杨顾问',
  '周顾问'
];

module.exports = {
  initDatabase,
  run,
  get,
  all,
  STATUS_FLOW,
  STATUS_LABELS,
  COURSES,
  RESPONSIBLES
};
