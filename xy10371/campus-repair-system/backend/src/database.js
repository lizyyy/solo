const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

let db = null;
const dbPath = path.join(__dirname, '../data/database.db');

async function initDatabase() {
  const SQL = await initSqlJs();

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
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      student_id TEXT NOT NULL UNIQUE,
      dormitory TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      worker_id TEXT NOT NULL UNIQUE,
      specialty TEXT NOT NULL,
      status TEXT DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS repair_orders (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      building TEXT NOT NULL,
      room TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      assigned_at TEXT,
      completed_at TEXT,
      worker_id TEXT,
      satisfaction INTEGER
    );

    CREATE TABLE IF NOT EXISTS material_usages (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      used_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignment_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      action TEXT NOT NULL,
      worker_id TEXT,
      reason TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  saveDatabase();
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function prepare(sql) {
  return {
    run: function(...params) {
      const processedParams = params.map(p => 
        p === null || p === undefined ? '' : p
      );
      const stmt = db.prepare(sql);
      stmt.bind(processedParams);
      stmt.step();
      stmt.free();
      saveDatabase();
    },
    get: function(...params) {
      const processedParams = params.map(p => 
        p === null || p === undefined ? '' : p
      );
      const stmt = db.prepare(sql);
      if (processedParams.length > 0 && processedParams.some(p => p !== '')) {
        stmt.bind(processedParams);
      }
      
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return Object.keys(result).length > 0 ? result : undefined;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const processedParams = params.map(p => 
        p === null || p === undefined ? '' : p
      );
      const stmt = db.prepare(sql);
      if (processedParams.length > 0 && processedParams.some(p => p !== '')) {
        stmt.bind(processedParams);
      }
      
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDatabase();
}

function transaction(fn) {
  try {
    fn();
    saveDatabase();
  } catch (e) {
    throw e;
  }
}

function seedData() {
  const studentResult = db.exec('SELECT COUNT(*) as count FROM students');
  if (studentResult.length > 0 && studentResult[0].values.length > 0 && studentResult[0].values[0][0] > 0) {
    return;
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const insertStudent = prepare('INSERT INTO students (id, name, student_id, dormitory) VALUES (?, ?, ?, ?)');
  const insertWorker = prepare('INSERT INTO workers (id, name, worker_id, specialty, status) VALUES (?, ?, ?, ?, ?)');
  const insertMaterial = prepare('INSERT INTO materials (id, name, unit, stock) VALUES (?, ?, ?, ?)');
  const insertUsage = prepare('INSERT INTO material_usages (id, order_id, material_id, quantity, used_at) VALUES (?, ?, ?, ?, ?)');

  const students = [
    { id: 's1', name: '张三', student_id: '2024001', dormitory: '1号楼302' },
    { id: 's2', name: '李四', student_id: '2024002', dormitory: '2号楼105' },
    { id: 's3', name: '王五', student_id: '2024003', dormitory: '1号楼201' },
    { id: 's4', name: '赵六', student_id: '2024004', dormitory: '3号楼408' }
  ];

  const workers = [
    { id: 'w1', name: '李师傅', worker_id: 'W001', specialty: '水电', status: 'available' },
    { id: 'w2', name: '王师傅', worker_id: 'W002', specialty: '门窗', status: 'busy' },
    { id: 'w3', name: '张师傅', worker_id: 'W003', specialty: '综合', status: 'available' }
  ];

  const materials = [
    { id: 'm1', name: '水管接头', unit: '个', stock: 50 },
    { id: 'm2', name: '门锁芯', unit: '个', stock: 30 },
    { id: 'm3', name: '生料带', unit: '卷', stock: 100 },
    { id: 'm4', name: '螺丝', unit: '个', stock: 500 },
    { id: 'm5', name: '密封胶', unit: '支', stock: 20 }
  ];

  transaction(() => {
    students.forEach(s => insertStudent.run(s.id, s.name, s.student_id, s.dormitory));
    workers.forEach(w => insertWorker.run(w.id, w.name, w.worker_id, w.specialty, w.status));
    materials.forEach(m => insertMaterial.run(m.id, m.name, m.unit, m.stock));

    db.run(`INSERT INTO repair_orders (id, student_id, building, room, category, description, urgency, status, created_at) VALUES ('o1', 's1', '1号楼', '302', '水电', '浴室水管爆裂，漏水严重', 'urgent', 'pending', '${dayjs().subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss')}')`);
    db.run(`INSERT INTO repair_orders (id, student_id, building, room, category, description, urgency, status, created_at, assigned_at, worker_id) VALUES ('o2', 's2', '2号楼', '105', '门窗', '宿舍门锁损坏，无法正常开关', 'normal', 'assigned', '${dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')}', '${dayjs().subtract(20, 'hour').format('YYYY-MM-DD HH:mm:ss')}', 'w2')`);
    db.run(`INSERT INTO repair_orders (id, student_id, building, room, category, description, urgency, status, created_at, assigned_at, completed_at, worker_id, satisfaction) VALUES ('o3', 's3', '1号楼', '201', '水电', '水龙头漏水', 'low', 'completed', '${dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss')}', '${dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss')}', '${dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')}', 'w1', 5)`);

    insertUsage.run('mu1', 'o3', 'm3', 2, dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'));
  });
}

module.exports = {
  prepare,
  exec,
  transaction,
  initDatabase,
  seedData,
  saveDatabase
};
