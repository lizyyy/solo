const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/loss_report.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS loss_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_no TEXT UNIQUE NOT NULL,
      station_code TEXT NOT NULL,
      station_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      reporter_code TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      vegetable_code TEXT NOT NULL,
      vegetable_name TEXT NOT NULL,
      vegetable_category TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      delivery_order_no TEXT,
      purchase_order_no TEXT,
      loss_type TEXT NOT NULL,
      loss_quantity REAL NOT NULL,
      loss_weight REAL NOT NULL,
      loss_unit TEXT NOT NULL,
      loss_reason TEXT NOT NULL,
      loss_description TEXT,
      discovery_time TEXT,
      discovery_location TEXT,
      handler_name TEXT,
      related_docs TEXT,
      status TEXT DEFAULT 'pending',
      auditor_code TEXT,
      auditor_name TEXT,
      audit_time TEXT,
      audit_opinion TEXT,
      next_step_required TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS loss_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      record_type TEXT NOT NULL,
      record_no TEXT,
      vegetable_code TEXT NOT NULL,
      vegetable_name TEXT NOT NULL,
      loss_quantity REAL NOT NULL,
      loss_weight REAL NOT NULL,
      deduct_date TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES loss_reports(id)
    )
  `);

  const sampleReports = [
    {
      report_no: 'BS20240518001',
      station_code: 'BJ001',
      station_name: '北京朝阳配送站',
      report_date: '2024-05-18',
      reporter_code: 'R001',
      reporter_name: '张三',
      vegetable_code: 'V001',
      vegetable_name: '大白菜',
      vegetable_category: '叶菜类',
      batch_no: 'B20240518001',
      delivery_order_no: 'D20240518001',
      purchase_order_no: 'P20240518001',
      loss_type: 'transport_loss',
      loss_quantity: 50,
      loss_weight: 25.5,
      loss_unit: '公斤',
      loss_reason: '运输途中挤压破损',
      loss_description: '车辆转弯时蔬菜箱倾倒，部分菜叶破损严重',
      discovery_time: '2024-05-18 08:30:00',
      discovery_location: '配送站卸货区',
      handler_name: '李四',
      related_docs: '运输单T20240518001,照片IMG_001.jpg',
      status: 'approved',
      auditor_code: 'A001',
      auditor_name: '王经理',
      audit_time: '2024-05-18 09:00:00',
      audit_opinion: '情况属实，同意报损'
    },
    {
      report_no: 'BS20240518002',
      station_code: 'BJ001',
      station_name: '北京朝阳配送站',
      report_date: '2024-05-18',
      reporter_code: 'R002',
      reporter_name: '王五',
      vegetable_code: 'V002',
      vegetable_name: '西红柿',
      vegetable_category: '茄果类',
      batch_no: 'B20240518002',
      delivery_order_no: 'D20240518002',
      purchase_order_no: 'P20240518002',
      loss_type: 'store_loss',
      loss_quantity: 30,
      loss_weight: 15.0,
      loss_unit: '公斤',
      loss_reason: '门店保管不善腐烂',
      loss_description: '门店温度控制不当，部分西红柿腐烂',
      discovery_time: '2024-05-18 10:00:00',
      discovery_location: '门店冷藏区',
      handler_name: '赵六',
      related_docs: '门店盘点表P20240518',
      status: 'pending',
      next_step_required: '需要提供门店温度记录和腐烂蔬菜照片'
    },
    {
      report_no: 'BS20240518003',
      station_code: 'SH001',
      station_name: '上海浦东配送站',
      report_date: '2024-05-18',
      reporter_code: 'R003',
      reporter_name: '孙七',
      vegetable_code: 'V003',
      vegetable_name: '黄瓜',
      vegetable_category: '瓜类',
      batch_no: 'B20240518003',
      delivery_order_no: 'D20240518003',
      purchase_order_no: 'P20240518003',
      loss_type: 'transport_loss',
      loss_quantity: 20,
      loss_weight: 10.0,
      loss_unit: '公斤',
      loss_reason: '包装破损导致脱水',
      loss_description: '保鲜膜包装破损，黄瓜表面脱水干瘪',
      discovery_time: '2024-05-18 07:45:00',
      discovery_location: '运输车辆内',
      handler_name: '周八',
      related_docs: '包装检查记录表',
      status: 'pending'
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO loss_reports (
      report_no, station_code, station_name, report_date, reporter_code, reporter_name,
      vegetable_code, vegetable_name, vegetable_category, batch_no, delivery_order_no,
      purchase_order_no, loss_type, loss_quantity, loss_weight, loss_unit, loss_reason,
      loss_description, discovery_time, discovery_location, handler_name, related_docs,
      status, auditor_code, auditor_name, audit_time, audit_opinion, next_step_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleReports.forEach(report => {
    stmt.run(
      report.report_no, report.station_code, report.station_name, report.report_date,
      report.reporter_code, report.reporter_name, report.vegetable_code, report.vegetable_name,
      report.vegetable_category, report.batch_no, report.delivery_order_no, report.purchase_order_no,
      report.loss_type, report.loss_quantity, report.loss_weight, report.loss_unit, report.loss_reason,
      report.loss_description, report.discovery_time, report.discovery_location, report.handler_name,
      report.related_docs, report.status, report.auditor_code, report.auditor_name, report.audit_time,
      report.audit_opinion, report.next_step_required
    );
  });

  stmt.finalize();

  console.log('数据库初始化完成，示例数据已插入');
});

db.close();
