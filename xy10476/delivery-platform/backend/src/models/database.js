const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, '../../data/delivery.db');

let db = null;
let SQL = null;

const saveDatabase = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const run = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    saveDatabase();
    return { changes: db.getRowsModified() };
  } catch (error) {
    console.error('SQL error:', error);
    throw error;
  }
};

const get = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (error) {
    console.error('SQL error:', error);
    throw error;
  }
};

const all = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error('SQL error:', error);
    throw error;
  }
};

const prepare = (sql) => {
  const stmt = db.prepare(sql);
  
  return {
    get: (...params) => {
      if (params.length > 0) {
        stmt.bind(params);
      }
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.reset();
      return result;
    },
    all: (...params) => {
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.reset();
      return results;
    },
    run: (...params) => {
      if (params.length > 0) {
        stmt.bind(params);
      }
      stmt.step();
      stmt.reset();
      saveDatabase();
      return { changes: db.getRowsModified(), lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] };
    },
    free: () => stmt.free()
  };
};

const initDatabase = async () => {
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_no TEXT NOT NULL,
      unit_no TEXT NOT NULL,
      room_no TEXT NOT NULL,
      owner_name TEXT,
      owner_phone TEXT,
      delivery_date TEXT,
      status TEXT DEFAULT '未交付',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      problem_type TEXT NOT NULL,
      problem_category TEXT NOT NULL,
      description TEXT NOT NULL,
      photos TEXT,
      location TEXT,
      inspection_date TEXT NOT NULL,
      status TEXT DEFAULT '待派单',
      owner_confirmed INTEGER DEFAULT 0,
      owner_confirm_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL,
      contractor_id INTEGER NOT NULL,
      assigned_date TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT DEFAULT '待整改',
      rework_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rechecks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL,
      work_order_id INTEGER NOT NULL,
      recheck_date TEXT NOT NULL,
      result TEXT NOT NULL,
      photos TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL,
      work_order_id INTEGER NOT NULL,
      delay_days INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT '待确认',
      calculation_basis TEXT,
      confirmed_by TEXT,
      confirmed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();

  const contractorCount = get('SELECT COUNT(*) as count FROM contractors');
  if (!contractorCount || contractorCount.count === 0) {
    const contractors = [
      ['墙面施工队', '张工', '13800138001', '墙面工程'],
      ['门窗安装队', '李工', '13800138002', '门窗工程'],
      ['水电施工队', '王工', '13800138003', '水电工程'],
      ['综合维修队', '赵工', '13800138004', '综合维修']
    ];

    contractors.forEach(([name, contact, phone, category]) => {
      run(
        'INSERT INTO contractors (name, contact_person, phone, category) VALUES (?, ?, ?, ?)',
        [name, contact, phone, category]
      );
    });

    const buildings = [
      ['1栋', '1单元', '101', '张三', '13900139001', '2026-05-01', '交付中'],
      ['1栋', '1单元', '102', '李四', '13900139002', '2026-05-02', '交付中'],
      ['2栋', '2单元', '501', '王五', '13900139003', '2026-05-03', '未交付'],
      ['3栋', '1单元', '302', '赵六', '13900139004', '2026-05-05', '已交付']
    ];

    buildings.forEach(([b, u, r, o, p, d, s]) => {
      run(
        'INSERT INTO buildings (building_no, unit_no, room_no, owner_name, owner_phone, delivery_date, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [b, u, r, o, p, d, s, dayjs().format('YYYY-MM-DD HH:mm:ss')]
      );
    });

    const problems = [
      [1, '墙面空鼓', '墙面工程', '客厅墙面存在3处空鼓，面积约0.5㎡', '客厅北墙', '2026-05-05', '待派单'],
      [1, '门窗渗水', '门窗工程', '主卧窗户密封条破损，雨天渗水痕迹明显', '主卧窗户', '2026-05-05', '待整改'],
      [2, '电路问题', '水电工程', '次卧插座无电，检查发现线路未接通', '次卧床头插座', '2026-05-06', '待复验'],
      [4, '墙面空鼓', '墙面工程', '厨房墙面瓷砖空鼓', '厨房', '2026-05-10', '已完成']
    ];

    problems.forEach(([b, t, c, d, l, i, s]) => {
      run(
        'INSERT INTO inspection_problems (building_id, problem_type, problem_category, description, location, inspection_date, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [b, t, c, d, l, i, s, dayjs().format('YYYY-MM-DD HH:mm:ss')]
      );
    });

    const workOrders = [
      [2, 2, '2026-05-06', '2026-05-12', '待整改'],
      [3, 3, '2026-05-07', '2026-05-14', '待复验'],
      [4, 1, '2026-05-11', '2026-05-17', '已完成']
    ];

    workOrders.forEach(([p, c, a, d, s]) => {
      run(
        'INSERT INTO work_orders (problem_id, contractor_id, assigned_date, deadline, status) VALUES (?, ?, ?, ?, ?)',
        [p, c, a, d, s]
      );
    });

    run(
      'INSERT INTO rechecks (problem_id, work_order_id, recheck_date, result, remarks) VALUES (?, ?, ?, ?, ?)',
      [4, 3, '2026-05-16', '通过', '整改合格']
    );

    saveDatabase();
  }
};

const getLastInsertRowid = () => {
  const result = db.exec('SELECT last_insert_rowid() as id');
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return 0;
};

const transaction = (fn) => {
  db.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
};

module.exports = {
  init: initDatabase,
  run,
  get,
  all,
  prepare,
  transaction,
  getLastInsertRowid,
  saveDatabase
};
