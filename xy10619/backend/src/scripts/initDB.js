const db = require('../models/database');

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS modification_logs`);
  db.run(`DROP TABLE IF EXISTS reader_debts`);
  db.run(`DROP TABLE IF EXISTS reduction_approvals`);
  db.run(`DROP TABLE IF EXISTS replacement_books`);
  db.run(`DROP TABLE IF EXISTS lost_compensation`);
  db.run(`DROP TABLE IF EXISTS anomalies`);
  db.run(`DROP TABLE IF EXISTS borrow_records`);
  db.run(`DROP TABLE IF EXISTS damage_levels`);
  db.run(`DROP TABLE IF EXISTS books`);
  db.run(`DROP TABLE IF EXISTS readers`);
  db.run(`DROP TABLE IF EXISTS staff`);

  db.run(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS readers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    student_id TEXT UNIQUE,
    phone TEXT,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    isbn TEXT,
    author TEXT,
    publisher TEXT,
    price REAL NOT NULL,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS damage_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_name TEXT NOT NULL,
    description TEXT,
    compensation_ratio REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reader_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    borrow_date DATETIME NOT NULL,
    due_date DATETIME NOT NULL,
    return_date DATETIME,
    is_overdue BOOLEAN DEFAULT 0,
    overdue_days INTEGER DEFAULT 0,
    overdue_fine REAL DEFAULT 0,
    damage_level_id INTEGER,
    damage_compensation REAL DEFAULT 0,
    status TEXT DEFAULT 'borrowed',
    processed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reader_id) REFERENCES readers(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (damage_level_id) REFERENCES damage_levels(id),
    FOREIGN KEY (processed_by) REFERENCES staff(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    anomaly_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    is_resolved BOOLEAN DEFAULT 0,
    resolved_by INTEGER,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resolved_by) REFERENCES staff(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lost_compensation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borrow_record_id INTEGER NOT NULL,
    compensation_amount REAL NOT NULL,
    compensation_type TEXT NOT NULL,
    is_paid BOOLEAN DEFAULT 0,
    paid_date DATETIME,
    processed_by INTEGER,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
    FOREIGN KEY (processed_by) REFERENCES staff(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS replacement_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lost_compensation_id INTEGER NOT NULL,
    book_title TEXT NOT NULL,
    isbn TEXT,
    publisher TEXT,
    accept_status TEXT DEFAULT 'pending',
    accept_date DATETIME,
    accepted_by INTEGER,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lost_compensation_id) REFERENCES lost_compensation(id),
    FOREIGN KEY (accepted_by) REFERENCES staff(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reduction_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL,
    reduction_amount REAL NOT NULL,
    reduction_reason TEXT NOT NULL,
    approval_status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    approved_at DATETIME,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approved_by) REFERENCES staff(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reader_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reader_id INTEGER NOT NULL,
    borrow_record_id INTEGER,
    debt_type TEXT NOT NULL,
    original_amount REAL NOT NULL,
    reduction_amount REAL DEFAULT 0,
    final_amount REAL NOT NULL,
    is_paid BOOLEAN DEFAULT 0,
    paid_date DATETIME,
    processed_by INTEGER,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reader_id) REFERENCES readers(id),
    FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
    FOREIGN KEY (processed_by) REFERENCES staff(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    modified_by INTEGER,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modified_by) REFERENCES staff(id)
  )`);

  const staffStmt = db.prepare(`INSERT INTO staff (name, department) VALUES (?, ?)`);
  staffStmt.run('张管理员', '流通部');
  staffStmt.run('李老师', '采编部');
  staffStmt.run('王主任', '办公室');
  staffStmt.finalize();

  const damageStmt = db.prepare(`INSERT INTO damage_levels (level_name, description, compensation_ratio) VALUES (?, ?, ?)`);
  damageStmt.run('轻微', '少量污渍、不影响阅读', 0.1);
  damageStmt.run('一般', '页面破损、影响阅读', 0.3);
  damageStmt.run('严重', '图书严重破损、无法修复', 0.8);
  damageStmt.run('遗失', '图书完全遗失', 1.0);
  damageStmt.finalize();

  const readersStmt = db.prepare(`INSERT INTO readers (name, student_id, phone, department) VALUES (?, ?, ?, ?)`);
  readersStmt.run('张三', '2024001', '13800138001', '计算机学院');
  readersStmt.run('李四', '2024002', '13800138002', '文学院');
  readersStmt.run('王五', '2024003', '13800138003', '理学院');
  readersStmt.finalize();

  const booksStmt = db.prepare(`INSERT INTO books (title, isbn, author, publisher, price) VALUES (?, ?, ?, ?, ?)`);
  booksStmt.run('JavaScript高级程序设计', '9787115545381', 'Zakas', '人民邮电出版社', 129.00);
  booksStmt.run('三体', '9787536692930', '刘慈欣', '重庆出版社', 68.00);
  booksStmt.run('活着', '9787506365437', '余华', '作家出版社', 39.00);
  booksStmt.run('百年孤独', '9787544253990', '马尔克斯', '南海出版公司', 55.00);
  booksStmt.finalize();

  const borrowStmt = db.prepare(`INSERT INTO borrow_records (reader_id, book_id, borrow_date, due_date, return_date, is_overdue, overdue_days, overdue_fine, damage_level_id, damage_compensation, status, processed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  borrowStmt.run(1, 1, '2024-04-01', '2024-05-01', '2024-05-10', 1, 9, 4.5, null, 0, 'returned', 1);
  borrowStmt.run(2, 2, '2024-04-15', '2024-05-15', null, 0, 0, 0, null, 0, 'borrowed', 1);
  borrowStmt.run(3, 3, '2024-03-01', '2024-04-01', '2024-04-20', 1, 19, 9.5, 2, 11.7, 'damaged', 2);
  borrowStmt.finalize();

  const lostStmt = db.prepare(`INSERT INTO lost_compensation (borrow_record_id, compensation_amount, compensation_type, is_paid, processed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)`);
  lostStmt.run(3, 39.00, 'lost', 0, 1, '图书遗失，按原价赔偿');
  lostStmt.finalize();

  const debtStmt = db.prepare(`INSERT INTO reader_debts (reader_id, borrow_record_id, debt_type, original_amount, reduction_amount, final_amount, is_paid, processed_by, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  debtStmt.run(1, 1, 'overdue', 4.5, 0, 4.5, 0, 1, '逾期9天费用');
  debtStmt.run(3, 3, 'damage', 11.7, 0, 11.7, 0, 2, '图书破损赔偿');
  debtStmt.run(3, 3, 'lost', 39.0, 0, 39.0, 0, 1, '图书遗失赔偿');
  debtStmt.finalize();

  const anomalyStmt = db.prepare(`INSERT INTO anomalies (record_type, record_id, anomaly_type, description, severity, is_resolved) VALUES (?, ?, ?, ?, ?, ?)`);
  anomalyStmt.run('borrow', 3, 'overdue_damage', '该借阅同时存在逾期和破损情况', 'high', 0);
  anomalyStmt.run('debt', 3, 'high_amount', '欠费金额超过30元', 'medium', 0);
  anomalyStmt.finalize();

  console.log('数据库初始化完成！');
});

db.close();
