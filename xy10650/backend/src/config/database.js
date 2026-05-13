const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/safety.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      leader TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS hazards (
      id TEXT PRIMARY KEY,
      photo_url TEXT,
      description TEXT NOT NULL,
      location TEXT,
      risk_level TEXT CHECK(risk_level IN ('低', '中', '高', '极高')) DEFAULT '中',
      team_id TEXT,
      deadline DATETIME,
      status TEXT CHECK(status IN ('待整改', '整改中', '待复查', '已通过', '已罚款')) DEFAULT '待整改',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      hazard_id TEXT NOT NULL,
      reviewer TEXT,
      opinion TEXT NOT NULL,
      result TEXT CHECK(result IN ('通过', '不通过', '需整改')) NOT NULL,
      review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      photo_url TEXT,
      FOREIGN KEY (hazard_id) REFERENCES hazards(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS fines (
      id TEXT PRIMARY KEY,
      hazard_id TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      reason TEXT NOT NULL,
      status TEXT CHECK(status IN ('待复核', '已确认', '已缴纳', '已撤销')) DEFAULT '待复核',
      reviewed_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hazard_id) REFERENCES hazards(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      hazard_id TEXT,
      operation_type TEXT NOT NULL,
      operator TEXT,
      before_data TEXT,
      after_data TEXT,
      result TEXT CHECK(result IN ('成功', '拦截', '人工修正', '重复提交')) NOT NULL,
      reason TEXT,
      request_id TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS deadline_changes (
      id TEXT PRIMARY KEY,
      hazard_id TEXT NOT NULL,
      old_deadline DATETIME,
      new_deadline DATETIME,
      reason TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hazard_id) REFERENCES hazards(id)
    )`);
  });
}

module.exports = db;