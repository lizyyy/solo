import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: any = null;
let SQL: any = null;
const dbPath = path.join(__dirname, '..', 'data', 'nanny_service.db');

async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
    });
  }

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS nannies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      level TEXT,
      daily_rate REAL DEFAULT 500,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE,
      customer_id INTEGER NOT NULL,
      nanny_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      deposit REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      nanny_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_id INTEGER,
      order_id INTEGER NOT NULL,
      original_nanny_id INTEGER NOT NULL,
      replacement_nanny_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      nanny_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      deduction_amount REAL DEFAULT 0,
      deduction_reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS history_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  saveDatabase();
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function insertSampleData() {
  const result = db.exec('SELECT COUNT(*) as count FROM nannies');
  if (result.length > 0 && result[0].values[0][0] > 0) return;

  const nannyData = [
    ['张桂英', '13800138001', '110101198001011234', '高级月嫂', 600, 'available'],
    ['李秀兰', '13800138002', '110101198001021234', '中级月嫂', 500, 'available'],
    ['王淑华', '13800138003', '110101198001031234', '高级月嫂', 600, 'available'],
    ['赵翠花', '13800138004', '110101198001041234', '初级月嫂', 400, 'available'],
    ['刘美琴', '13800138005', '110101198001051234', '中级月嫂', 500, 'available'],
  ];

  for (const nanny of nannyData) {
    db.run(
      'INSERT INTO nannies (name, phone, id_card, level, daily_rate, status) VALUES (?, ?, ?, ?, ?, ?)',
      nanny
    );
  }

  const customerData = [
    ['陈小明', '13900139001', '北京市朝阳区建国路88号'],
    ['林小芳', '13900139002', '北京市海淀区中关村大街1号'],
    ['黄小华', '13900139003', '北京市西城区西单北大街1号'],
  ];

  for (const customer of customerData) {
    db.run(
      'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
      customer
    );
  }

  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, days: number) => {
    const newDate = new Date(d);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  };

  const orderData = [
    [
      'ORD202605001', 1, 1,
      formatDate(addDays(today, -30)),
      formatDate(addDays(today, -10)),
      20, 12000, 3000, 'completed'
    ],
    [
      'ORD202605002', 2, 2,
      formatDate(addDays(today, -20)),
      formatDate(addDays(today, 10)),
      30, 15000, 4000, 'in_service'
    ],
    [
      'ORD202605003', 3, 3,
      formatDate(addDays(today, -15)),
      formatDate(addDays(today, 15)),
      30, 18000, 5000, 'in_service'
    ],
  ];

  for (const order of orderData) {
    db.run(
      'INSERT INTO orders (order_no, customer_id, nanny_id, start_date, end_date, total_days, total_amount, deposit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      order
    );
  }

  const leaveData = [
    [
      2, 2,
      formatDate(addDays(today, -15)),
      formatDate(addDays(today, -13)),
      3, '家中有事', 'approved'
    ],
    [
      3, 3,
      formatDate(addDays(today, -5)),
      formatDate(addDays(today, -2)),
      4, '身体不适', 'approved'
    ],
  ];

  for (const leave of leaveData) {
    db.run(
      'INSERT INTO leaves (order_id, nanny_id, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      leave
    );
  }

  const replacementData = [
    [
      1, 2, 2, 4,
      formatDate(addDays(today, -15)),
      formatDate(addDays(today, -13)),
      3, 'completed'
    ],
    [
      2, 3, 3, 5,
      formatDate(addDays(today, -5)),
      formatDate(addDays(today, -2)),
      4, 'completed'
    ],
  ];

  for (const rep of replacementData) {
    db.run(
      'INSERT INTO replacements (leave_id, order_id, original_nanny_id, replacement_nanny_id, start_date, end_date, days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      rep
    );
  }

  db.run(
    'INSERT INTO evaluations (order_id, nanny_id, rating, comment, deduction_amount, deduction_reason) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 1, 3, '服务态度一般，工作不够细致。', 600, '服务态度差，迟到早退']
  );

  saveDatabase();
}

function prepare(sql: string) {
  const stmt = db.prepare(sql);

  return {
    run: (...params: any[]) => {
      stmt.bind(params);
      stmt.step();
      stmt.free();
      saveDatabase();
      return {
        lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0],
        changes: db.getRowsModified()
      };
    },
    all: (...params: any[]) => {
      stmt.bind(params);
      const results: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj: any = {};
        columns.forEach((col: string, idx: number) => {
          const camelCase = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          obj[camelCase] = row[idx];
        });
        results.push(obj);
      }
      stmt.free();
      return results;
    },
    get: (...params: any[]) => {
      const all = prepare(sql).all(...params);
      return all.length > 0 ? all[0] : undefined;
    }
  };
}

function exec(sql: string) {
  const results = db.exec(sql);
  saveDatabase();
  return results;
}

export { initDatabase, insertSampleData, prepare, exec };
