const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始创建数据表...');

  db.run(`CREATE TABLE IF NOT EXISTS engineers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    skill_level TEXT DEFAULT '中级',
    status TEXT DEFAULT '在岗',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS engineer_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS spare_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_code TEXT UNIQUE NOT NULL,
    part_name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    unit TEXT DEFAULT '个',
    location TEXT,
    min_stock INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS repair_workorders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workorder_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    address TEXT,
    product_model TEXT,
    fault_description TEXT,
    status TEXT DEFAULT '待分配',
    engineer_id INTEGER,
    scheduled_date DATE,
    scheduled_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reservation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workorder_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    engineer_id INTEGER,
    status TEXT DEFAULT '已预占',
    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME NOT NULL,
    released_at DATETIME,
    release_reason_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workorder_id) REFERENCES repair_workorders(id),
    FOREIGN KEY (part_id) REFERENCES spare_parts(id),
    FOREIGN KEY (release_reason_id) REFERENCES release_reasons(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS release_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reason_code TEXT UNIQUE NOT NULL,
    reason_name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fulfillment_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workorder_id INTEGER NOT NULL,
    engineer_id INTEGER,
    parts_used TEXT,
    actual_start_time DATETIME,
    actual_end_time DATETIME,
    fulfillment_status TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workorder_id) REFERENCES repair_workorders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_path TEXT,
    request_method TEXT,
    request_body TEXT,
    error_message TEXT,
    processing_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据表创建完成，开始清空旧数据...');

  const tables = [
    'fulfillment_summaries',
    'reservation_records',
    'engineer_schedules',
    'repair_workorders',
    'spare_parts',
    'engineers',
    'release_reasons',
    'exception_logs'
  ];

  tables.forEach(table => {
    db.run(`DELETE FROM ${table}`);
    db.run(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
  });

  console.log('旧数据已清空，开始插入样例数据...');

  const reasonStmt = db.prepare(`INSERT OR IGNORE INTO release_reasons (reason_code, reason_name, description) VALUES (?, ?, ?)`);
  const reasons = [
    ['TIMEOUT', '超时释放', '预占超时自动释放'],
    ['CANCEL', '工单取消', '工单取消主动释放'],
    ['REASSIGN', '工单改派', '工单改派释放'],
    ['COMPLETE', '工单完成', '工单完成扣减释放'],
    ['MANUAL', '人工释放', '人工操作释放']
  ];
  reasons.forEach(r => reasonStmt.run(r));
  reasonStmt.finalize();

  const engineerStmt = db.prepare(`INSERT INTO engineers (name, phone, skill_level, status) VALUES (?, ?, ?, ?)`);
  const engineers = [
    ['张工', '13800138001', '高级', '在岗'],
    ['李工', '13800138002', '中级', '在岗'],
    ['王工', '13800138003', '初级', '在岗'],
    ['赵工', '13800138004', '高级', '休假']
  ];
  engineers.forEach(e => engineerStmt.run(e));
  engineerStmt.finalize();

  const scheduleStmt = db.prepare(`INSERT INTO engineer_schedules (engineer_id, work_date, time_slot, is_available) VALUES (?, ?, ?, ?)`);
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const schedules = [
    [1, today, '上午', 1],
    [1, today, '下午', 0],
    [1, tomorrow, '上午', 1],
    [1, tomorrow, '下午', 1],
    [2, today, '上午', 1],
    [2, today, '下午', 1],
    [3, today, '上午', 1],
    [3, tomorrow, '下午', 1]
  ];
  schedules.forEach(s => scheduleStmt.run(s));
  scheduleStmt.finalize();

  const partStmt = db.prepare(`INSERT INTO spare_parts (part_code, part_name, category, quantity, unit, location, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const parts = [
    ['AC-001', '空调压缩机', '空调配件', 15, '台', 'A区-01', 3],
    ['AC-002', '空调遥控器', '空调配件', 50, '个', 'A区-02', 10],
    ['WF-001', '洗衣机电机', '洗衣机配件', 8, '台', 'B区-01', 2],
    ['WF-002', '洗衣机排水管', '洗衣机配件', 100, '根', 'B区-02', 20],
    ['RF-001', '冰箱温控器', '冰箱配件', 20, '个', 'C区-01', 5],
    ['TV-001', '电视主板', '电视配件', 5, '块', 'D区-01', 2]
  ];
  parts.forEach(p => partStmt.run(p));
  partStmt.finalize();

  const workorderStmt = db.prepare(`INSERT INTO repair_workorders (workorder_no, customer_name, customer_phone, address, product_model, fault_description, status, engineer_id, scheduled_date, scheduled_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const workorders = [
    ['WO20240517001', '张三', '13900139001', '北京市朝阳区XX小区', '格力KFR-35GW', '空调不制冷', '已分配', 1, today, '上午'],
    ['WO20240517002', '李四', '13900139002', '北京市海淀区XX小区', '海尔XQG100', '洗衣机不排水', '待分配', null, null, null],
    ['WO20240517003', '王五', '13900139003', '北京市西城区XX小区', '美的BCD-258', '冰箱不制冷', '已完成', 2, today, '下午']
  ];
  workorders.forEach(w => workorderStmt.run(w));
  workorderStmt.finalize();

  const expiredAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const reservationStmt = db.prepare(`INSERT INTO reservation_records (workorder_id, part_id, quantity, engineer_id, status, expired_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const reservations = [
    [1, 1, 1, 1, '已预占', expiredAt],
    [1, 2, 1, 1, '已预占', expiredAt]
  ];
  reservations.forEach(r => reservationStmt.run(r));
  reservationStmt.finalize();

  console.log('样例数据插入完成！');
  console.log('数据库初始化成功！');
});

db.close();