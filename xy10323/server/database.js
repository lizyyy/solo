const initSqlJs = require('sql.js');
const fs = require('fs-extra');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, '..', 'deposit.db');

const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const initDb = async () => {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_no TEXT UNIQUE NOT NULL,
      room_no TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT,
      deposit_amount REAL NOT NULL DEFAULT 0,
      application_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      inspection_date TEXT NOT NULL,
      inspector TEXT NOT NULL,
      overall_condition TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      problem_type TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT,
      severity TEXT NOT NULL DEFAULT 'normal',
      estimated_cost REAL DEFAULT 0,
      is_rectified INTEGER NOT NULL DEFAULT 0,
      rectification_date TEXT,
      rectifier TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS property_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      fee_type TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      is_paid INTEGER NOT NULL DEFAULT 0,
      paid_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      refund_no TEXT UNIQUE NOT NULL,
      total_deposit REAL NOT NULL,
      deduction_amount REAL NOT NULL DEFAULT 0,
      deduction_reason TEXT,
      fee_offset_amount REAL NOT NULL DEFAULT 0,
      actual_refund REAL NOT NULL,
      refund_date TEXT NOT NULL,
      approver TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      action_details TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS deduction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (refund_id) REFERENCES refunds(id)
    )
  `);

  const countResult = db.exec('SELECT COUNT(*) as count FROM applications');
  const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;

  if (count === 0) {
    seedData();
  }

  saveDatabase();
  console.log('数据库初始化完成');
};

const seedData = () => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.run(`
    INSERT INTO applications (application_no, room_no, owner_name, phone, deposit_amount, application_date, status, created_at, updated_at)
    VALUES ('ZK-2024-001', '1栋2单元301', '张三', '13800138001', 5000.00, '2024-01-15', 'completed', ?, ?)
  `, [now, now]);
  const app1Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO applications (application_no, room_no, owner_name, phone, deposit_amount, application_date, status, created_at, updated_at)
    VALUES ('ZK-2024-002', '2栋1单元502', '李四', '13800138002', 5000.00, '2024-02-20', 'completed', ?, ?)
  `, [now, now]);
  const app2Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO applications (application_no, room_no, owner_name, phone, deposit_amount, application_date, status, created_at, updated_at)
    VALUES ('ZK-2024-003', '3栋3单元101', '王五', '13800138003', 5000.00, '2024-03-10', 'pending', ?, ?)
  `, [now, now]);
  const app3Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO inspections (application_id, inspection_date, inspector, overall_condition, created_at)
    VALUES (?, '2024-04-15', '李巡检', '装修规范，无明显问题', ?)
  `, [app1Id, now]);
  const ins1Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO refunds (application_id, refund_no, total_deposit, deduction_amount, deduction_reason, fee_offset_amount, actual_refund, refund_date, approver, status, remarks, created_at)
    VALUES (?, 'TK-2024-001', 5000.00, 0, NULL, 0, 5000.00, '2024-04-20', '王经理', 'approved', NULL, ?)
  `, [app1Id, now]);

  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '申请提交', '装修押金申请已提交，押金金额：¥5000.00', '系统', ?)`, [app1Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '巡检完成', '装修完工检查，整体状况良好，无整改需求', '李巡检', ?)`, [app1Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '退款审批', '全额退还押金 ¥5000.00，无扣款', '王经理', ?)`, [app1Id, now]);

  db.run(`
    INSERT INTO inspections (application_id, inspection_date, inspector, overall_condition, created_at)
    VALUES (?, '2024-05-10', '赵巡检', '发现墙体破损需要修复', ?)
  `, [app2Id, now]);
  const ins2Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO inspection_problems (inspection_id, problem_type, description, location, severity, estimated_cost, is_rectified, rectification_date, rectifier, created_at)
    VALUES (?, '墙体破损', '客厅西墙有2处约5cm裂缝', '客厅', 'normal', 800.00, 1, '2024-05-20', '装修队', ?)
  `, [ins2Id, now]);
  const prob1Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO refunds (application_id, refund_no, total_deposit, deduction_amount, deduction_reason, fee_offset_amount, actual_refund, refund_date, approver, status, remarks, created_at)
    VALUES (?, 'TK-2024-002', 5000.00, 800.00, '墙体破损修复费用', 0, 4200.00, '2024-05-25', '王经理', 'approved', NULL, ?)
  `, [app2Id, now]);
  const refund2Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO deduction_items (refund_id, item_type, description, amount, created_at)
    VALUES (?, '修复费用', '墙体破损修复人工费+材料费', 800.00, ?)
  `, [refund2Id, now]);

  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '申请提交', '装修押金申请已提交，押金金额：¥5000.00', '系统', ?)`, [app2Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '巡检发现问题', '发现客厅西墙有2处约5cm裂缝，预估修复费用¥800.00', '赵巡检', ?)`, [app2Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '整改完成', '墙体破损已修复完成', '装修队', ?)`, [app2Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '退款审批', '扣除修复费用¥800.00，实际退款¥4200.00', '王经理', ?)`, [app2Id, now]);

  db.run(`
    INSERT INTO inspections (application_id, inspection_date, inspector, overall_condition, created_at)
    VALUES (?, '2024-06-15', '李巡检', '装修完成，检查通过', ?)
  `, [app3Id, now]);
  const ins3Id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run(`
    INSERT INTO property_fees (application_id, fee_type, amount, due_date, is_paid, paid_date, created_at)
    VALUES (?, '2024年上半年物业费', 1800.00, '2024-06-30', 0, NULL, ?)
  `, [app3Id, now]);

  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '申请提交', '装修押金申请已提交，押金金额：¥5000.00', '系统', ?)`, [app3Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '巡检完成', '装修完工检查通过，无整改需求', '李巡检', ?)`, [app3Id, now]);
  db.run(`INSERT INTO timeline (application_id, action_type, action_details, operator, created_at) VALUES (?, '退款暂停', '存在未结清物业费¥1800.00，需先结清或从押金中抵扣后再退款', '系统', ?)`, [app3Id, now]);

  console.log('样例数据已初始化');
};

const prepare = (sql) => {
  return {
    run: (...params) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      saveDatabase();
      const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
      return {
        lastInsertRowid: lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : null
      };
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return undefined;
    },
    all: (...params) => {
      const results = [];
      const stmt = db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
};

module.exports = {
  db: {
    prepare,
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) => {
      db.run(sql, params);
      saveDatabase();
    }
  },
  initDb
};
