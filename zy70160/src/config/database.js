const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/tickets.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接错误:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 工单表
    db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        sla_deadline DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assignee_id TEXT
      )
    `);

    // SLA 配置表
    db.run(`
      CREATE TABLE IF NOT EXISTS sla_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        priority TEXT NOT NULL UNIQUE,
        response_time_hours INTEGER NOT NULL,
        resolution_time_hours INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1
      )
    `);

    // 暂停记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS sla_pauses (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        pause_type TEXT NOT NULL DEFAULT 'user_awaiting',
        paused_by TEXT,
        paused_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resumed_at DATETIME,
        status TEXT NOT NULL DEFAULT 'paused',
        notes TEXT,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      )
    `);

    // 升级记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS escalations (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        escalation_type TEXT NOT NULL,
        escalated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        escalated_to TEXT,
        details TEXT,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      )
    `);

    // 初始化 SLA 配置
    const checkConfig = `SELECT COUNT(*) as count FROM sla_configs`;
    db.get(checkConfig, (err, row) => {
      if (err) {
        console.error('检查 SLA 配置错误:', err);
        return;
      }
      
      if (row.count === 0) {
        const insertConfig = `
          INSERT INTO sla_configs (priority, response_time_hours, resolution_time_hours)
          VALUES 
            ('critical', 1, 4),
            ('high', 2, 8),
            ('normal', 4, 24),
            ('low', 8, 72)
        `;
        db.run(insertConfig, (err) => {
          if (err) {
            console.error('初始化 SLA 配置错误:', err);
          } else {
            console.log('SLA 配置已初始化');
          }
        });
      }
    });
  });
}

module.exports = db;
