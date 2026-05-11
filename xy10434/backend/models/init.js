const db = require('../database');
const bcrypt = require('bcryptjs');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building TEXT NOT NULL,
      unit TEXT NOT NULL,
      room_number TEXT NOT NULL,
      owner_id INTEGER,
      status TEXT DEFAULT 'empty',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS construction_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      leader_name TEXT,
      leader_phone TEXT,
      license TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS decorations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      team_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      start_date DATE,
      expected_end_date DATE,
      actual_end_date DATE,
      deposit_amount DECIMAL(10,2) DEFAULT 0,
      total_deduction DECIMAL(10,2) DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deposit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decoration_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method TEXT,
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decoration_id INTEGER NOT NULL,
      inspector TEXT,
      inspection_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      violation_type TEXT,
      description TEXT,
      deduction_amount DECIMAL(10,2) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      rectification_requirement TEXT,
      rectification_date DATE,
      rectification_result TEXT,
      reviewer TEXT,
      review_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      decoration_id INTEGER NOT NULL,
      deposit_received DECIMAL(10,2) DEFAULT 0,
      total_deduction DECIMAL(10,2) DEFAULT 0,
      refund_amount DECIMAL(10,2) NOT NULL,
      applicant TEXT,
      applicant_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewer TEXT,
      review_date DATETIME,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!userCount || userCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, password, role)
      VALUES (?, ?, ?)
    `).run('admin', hashedPassword, 'admin');
    console.log('默认管理员账号: admin / admin123');
  }

  console.log('数据库初始化完成');
}

module.exports = initDatabase;
