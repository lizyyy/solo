import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'merchant_review.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_name TEXT NOT NULL,
      merchant_code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS business_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      license_number TEXT NOT NULL,
      legal_representative TEXT NOT NULL,
      business_scope TEXT NOT NULL,
      valid_from DATE NOT NULL,
      valid_to DATE NOT NULL,
      status TEXT DEFAULT 'valid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS category_qualifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      category_name TEXT NOT NULL,
      category_code TEXT NOT NULL,
      qualification_type TEXT NOT NULL,
      qualification_number TEXT,
      valid_from DATE,
      valid_to DATE,
      status TEXT DEFAULT 'pending',
      review_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS deposit_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      order_number TEXT UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category TEXT NOT NULL,
      payment_status TEXT DEFAULT 'unpaid',
      payment_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rejection_supplements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      reviewer_name TEXT NOT NULL,
      rejection_reason TEXT NOT NULL,
      supplement_items TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      supplement_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS review_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      reviewer_name TEXT NOT NULL,
      comment TEXT NOT NULL,
      review_result TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS modification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      field_type TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      modifier_id INTEGER NOT NULL,
      modifier_name TEXT NOT NULL,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )`);

    initSampleData();
  });
}

function initSampleData() {
  db.get("SELECT COUNT(*) as count FROM merchants", (err, row) => {
    if (row.count === 0) {
      const merchants = [
        { merchant_name: '北京科技有限公司', merchant_code: 'BJ001', status: 'pending' },
        { merchant_name: '上海贸易有限公司', merchant_code: 'SH002', status: 'approved' },
        { merchant_name: '广州电商有限公司', merchant_code: 'GZ003', status: 'rejected' },
        { merchant_name: '深圳数码有限公司', merchant_code: 'SZ004', status: 'supplement' },
        { merchant_name: '杭州食品有限公司', merchant_code: 'HZ005', status: 'pending' }
      ];

      merchants.forEach(m => {
        db.run(`INSERT INTO merchants (merchant_name, merchant_code, status) VALUES (?, ?, ?)`,
          [m.merchant_name, m.merchant_code, m.status], function(err) {
            const merchantId = this.lastID;
            
            db.run(`INSERT INTO business_licenses (merchant_id, license_number, legal_representative, business_scope, valid_from, valid_to, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [merchantId, `LIC${merchantId}000${merchantId}`, `法人${merchantId}`, 
               '技术开发、技术服务、销售电子产品', '2020-01-01', '2030-01-01', 'valid']);

            db.run(`INSERT INTO category_qualifications (merchant_id, category_name, category_code, qualification_type, qualification_number, status)
              VALUES (?, ?, ?, ?, ?, ?)`,
              [merchantId, '电子产品', 'ELEC001', '销售许可证', `QUAL${merchantId}`, merchantId % 2 === 0 ? 'approved' : 'pending']);

            db.run(`INSERT INTO deposit_orders (merchant_id, order_number, amount, category, payment_status)
              VALUES (?, ?, ?, ?, ?)`,
              [merchantId, `DEP${merchantId}00${merchantId}`, 10000 * merchantId, '电子产品', 
               merchantId % 3 === 0 ? 'paid' : 'unpaid']);

            if (m.status === 'supplement' || m.status === 'rejected') {
              db.run(`INSERT INTO rejection_supplements (merchant_id, reviewer_id, reviewer_name, rejection_reason, supplement_items, status)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [merchantId, 1, '审核员A', '资质文件不完整', '营业执照复印件、授权书', m.status === 'supplement' ? 'pending' : 'completed']);
            }

            if (m.status !== 'pending') {
              db.run(`INSERT INTO review_comments (merchant_id, reviewer_id, reviewer_name, comment, review_result)
                VALUES (?, ?, ?, ?, ?)`,
                [merchantId, 1, '审核员A', 
                 m.status === 'approved' ? '资料齐全，符合入驻要求' : '需要补充相关资质文件',
                 m.status === 'approved' ? 'approved' : 'rejected']);
            }
          });
      });
      console.log('测试数据已初始化');
    }
  });
}

export default db;
