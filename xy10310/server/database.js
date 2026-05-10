const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, 'data', 'vehicle_inspection.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      id_card TEXT,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      plate_number TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      year INTEGER,
      vin TEXT,
      engine_number TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      material_type TEXT NOT NULL,
      is_collected INTEGER DEFAULT 0,
      collected_at TEXT,
      collected_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT,
      inspection_station TEXT,
      status TEXT DEFAULT 'scheduled',
      inspection_result TEXT,
      failure_reason TEXT,
      inspector TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vehicle_status (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      operator TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT,
      customer_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      operator TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    )`);

    const materialTypes = [
      '行驶证',
      '身份证',
      '交强险保单',
      '车船税证明',
      '车辆登记证书',
      '委托书',
      '其他材料'
    ];
    global.MATERIAL_TYPES = materialTypes;

    const statuses = [
      'created',
      'materials_collected',
      'appointment_scheduled',
      'inspection_completed',
      'inspection_failed',
      'retest_scheduled',
      'certificate_collected'
    ];
    global.STATUS_NAMES = {
      'created': '已创建',
      'materials_collected': '材料已收齐',
      'appointment_scheduled': '已预约',
      'inspection_completed': '检测通过',
      'inspection_failed': '检测失败',
      'retest_scheduled': '已重约',
      'certificate_collected': '已取证'
    };
    global.VEHICLE_STATUSES = statuses;

    const statusTransitions = {
      'created': ['materials_collected'],
      'materials_collected': ['appointment_scheduled'],
      'appointment_scheduled': ['inspection_completed', 'inspection_failed'],
      'inspection_completed': ['certificate_collected'],
      'inspection_failed': ['retest_scheduled'],
      'retest_scheduled': ['inspection_completed', 'inspection_failed', 'certificate_collected'],
      'certificate_collected': []
    };
    global.STATUS_TRANSITIONS = statusTransitions;

    console.log('数据库初始化完成');
  });
}

function generateId() {
  return uuidv4();
}

function now() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
  db,
  generateId,
  now
};
