const db = require('../config/database');
const moment = require('moment');

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS vehicle_mileage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT NOT NULL UNIQUE,
        vehicle_model TEXT NOT NULL,
        current_mileage INTEGER NOT NULL,
        last_maintenance_date TEXT,
        next_maintenance_mileage INTEGER,
        responsible_person TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS vehicle_mileage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        modified_by TEXT,
        modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicle_mileage(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS package_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        plate_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        package_name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        expire_date TEXT,
        status TEXT DEFAULT 'active',
        remaining_times INTEGER DEFAULT 0,
        used_times INTEGER DEFAULT 0,
        responsible_person TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS package_orders_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        modified_by TEXT,
        modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES package_orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS maintenance_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_code TEXT NOT NULL UNIQUE,
        item_name TEXT NOT NULL,
        description TEXT,
        standard_mileage INTEGER NOT NULL,
        standard_days INTEGER NOT NULL,
        price REAL NOT NULL,
        responsible_person TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS maintenance_items_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        modified_by TEXT,
        modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES maintenance_items(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS supplement_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name TEXT NOT NULL,
        item_id INTEGER,
        condition_type TEXT NOT NULL,
        condition_value REAL NOT NULL,
        supplement_amount REAL NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES maintenance_items(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS verification_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verification_no TEXT NOT NULL UNIQUE,
        order_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        mileage_at TEXT NOT NULL,
        actual_mileage INTEGER NOT NULL,
        supplement_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        handler TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        remarks TEXT,
        exception_reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES package_orders(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicle_mileage(id),
        FOREIGN KEY (item_id) REFERENCES maintenance_items(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS next_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        reminder_mileage INTEGER NOT NULL,
        reminder_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicle_mileage(id),
        FOREIGN KEY (item_id) REFERENCES maintenance_items(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exceptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exception_no TEXT NOT NULL UNIQUE,
        related_id INTEGER,
        related_type TEXT NOT NULL,
        exception_type TEXT NOT NULL,
        exception_reason TEXT NOT NULL,
        handler TEXT,
        old_value TEXT,
        new_value TEXT,
        status TEXT DEFAULT 'pending',
        corrected_by TEXT,
        corrected_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  };
};

const insertSampleData = () => {
  return new Promise((resolve, reject) => {
    const vehicles = [
      { plate_number: '京A12345', vehicle_model: '大众帕萨特', current_mileage: 45000, last_maintenance_date: '2024-01-15', next_maintenance_mileage: 50000, responsible_person: '张三' },
      { plate_number: '京B67890', vehicle_model: '丰田凯美瑞', current_mileage: 32000, last_maintenance_date: '2024-02-20', next_maintenance_mileage: 37000, responsible_person: '李四' },
      { plate_number: '京C11111', vehicle_model: '本田雅阁', current_mileage: 68000, last_maintenance_date: '2024-03-10', next_maintenance_mileage: 73000, responsible_person: '王五' }
    ];

    const vehicleStmt = db.prepare('INSERT OR IGNORE INTO vehicle_mileage (plate_number, vehicle_model, current_mileage, last_maintenance_date, next_maintenance_mileage, responsible_person) VALUES (?, ?, ?, ?, ?, ?)');
    vehicles.forEach(v => vehicleStmt.run(v.plate_number, v.vehicle_model, v.current_mileage, v.last_maintenance_date, v.next_maintenance_mileage, v.responsible_person));
    vehicleStmt.finalize();

    const orders = [
      { order_no: 'ORD2024001', plate_number: '京A12345', customer_name: '张先生', package_name: '基础保养套餐A', total_amount: 1500, purchase_date: '2024-01-01', expire_date: '2025-01-01', remaining_times: 3, used_times: 1, responsible_person: '张三' },
      { order_no: 'ORD2024002', plate_number: '京B67890', customer_name: '李女士', package_name: '高级保养套餐B', total_amount: 2800, purchase_date: '2024-02-01', expire_date: '2025-02-01', remaining_times: 2, used_times: 0, responsible_person: '李四' },
      { order_no: 'ORD2024003', plate_number: '京C11111', customer_name: '王先生', package_name: '基础保养套餐A', total_amount: 1500, purchase_date: '2024-03-01', expire_date: '2025-03-01', remaining_times: 4, used_times: 2, responsible_person: '王五' }
    ];

    const orderStmt = db.prepare('INSERT OR IGNORE INTO package_orders (order_no, plate_number, customer_name, package_name, total_amount, purchase_date, expire_date, remaining_times, used_times, responsible_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    orders.forEach(o => orderStmt.run(o.order_no, o.plate_number, o.customer_name, o.package_name, o.total_amount, o.purchase_date, o.expire_date, o.remaining_times, o.used_times, o.responsible_person));
    orderStmt.finalize();

    const items = [
      { item_code: 'MI001', item_name: '机油更换', description: '更换发动机机油', standard_mileage: 5000, standard_days: 180, price: 300, responsible_person: '赵六' },
      { item_code: 'MI002', item_name: '滤芯更换', description: '更换机油滤芯', standard_mileage: 10000, standard_days: 365, price: 100, responsible_person: '赵六' },
      { item_code: 'MI003', item_name: '刹车检查', description: '刹车片磨损检查', standard_mileage: 20000, standard_days: 365, price: 150, responsible_person: '孙七' },
      { item_code: 'MI004', item_name: '轮胎换位', description: '四轮换位平衡', standard_mileage: 10000, standard_days: 180, price: 80, responsible_person: '孙七' }
    ];

    const itemStmt = db.prepare('INSERT OR IGNORE INTO maintenance_items (item_code, item_name, description, standard_mileage, standard_days, price, responsible_person) VALUES (?, ?, ?, ?, ?, ?, ?)');
    items.forEach(i => itemStmt.run(i.item_code, i.item_name, i.description, i.standard_mileage, i.standard_days, i.price, i.responsible_person));
    itemStmt.finalize();

    const rules = [
      { rule_name: '超里程10%补差', item_id: 1, condition_type: 'mileage_over', condition_value: 10, supplement_amount: 50, description: '超里程10%以上加收50元' },
      { rule_name: '超期30天补差', item_id: 1, condition_type: 'date_over', condition_value: 30, supplement_amount: 30, description: '超期30天以上加收30元' }
    ];

    const ruleStmt = db.prepare('INSERT OR IGNORE INTO supplement_rules (rule_name, item_id, condition_type, condition_value, supplement_amount, description) VALUES (?, ?, ?, ?, ?, ?)');
    rules.forEach(r => ruleStmt.run(r.rule_name, r.item_id, r.condition_type, r.condition_value, r.supplement_amount, r.description));
    ruleStmt.finalize();

    const verifications = [
      { verification_no: 'VER2024001', order_id: 1, vehicle_id: 1, item_id: 1, mileage_at: '2024-01-15', actual_mileage: 45000, supplement_amount: 0, total_amount: 300, handler: '张三', remarks: '正常保养' },
      { verification_no: 'VER2024002', order_id: 3, vehicle_id: 3, item_id: 1, mileage_at: '2024-03-10', actual_mileage: 68000, supplement_amount: 50, total_amount: 350, handler: '王五', exception_reason: '超里程15%', remarks: '超里程补差' }
    ];

    const verStmt = db.prepare('INSERT OR IGNORE INTO verification_records (verification_no, order_id, vehicle_id, item_id, mileage_at, actual_mileage, supplement_amount, total_amount, handler, remarks, exception_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    verifications.forEach(v => verStmt.run(v.verification_no, v.order_id, v.vehicle_id, v.item_id, v.mileage_at, v.actual_mileage, v.supplement_amount, v.total_amount, v.handler, v.remarks, v.exception_reason));
    verStmt.finalize();

    const reminders = [
      { vehicle_id: 1, item_id: 1, reminder_mileage: 50000, reminder_date: '2024-07-15' },
      { vehicle_id: 2, item_id: 1, reminder_mileage: 37000, reminder_date: '2024-08-20' },
      { vehicle_id: 3, item_id: 1, reminder_mileage: 73000, reminder_date: '2024-09-10' }
    ];

    const remStmt = db.prepare('INSERT OR IGNORE INTO next_reminders (vehicle_id, item_id, reminder_mileage, reminder_date) VALUES (?, ?, ?, ?)');
    reminders.forEach(r => remStmt.run(r.vehicle_id, r.item_id, r.reminder_mileage, r.reminder_date));
    remStmt.finalize();

    const exceptions = [
      { exception_no: 'EXC2024001', related_id: 2, related_type: 'verification', exception_type: 'mileage_over', exception_reason: '超里程15%，超过标准10%', handler: '王五', old_value: '68000', new_value: '73000', status: 'resolved', corrected_by: '赵六', corrected_at: '2024-03-12' },
      { exception_no: 'EXC2024002', related_id: 1, related_type: 'reminder', exception_type: 'reminder_delay', exception_reason: '提醒日期计算错误', old_value: '2024-07-15', status: 'pending' }
    ];

    const excStmt = db.prepare('INSERT OR IGNORE INTO exceptions (exception_no, related_id, related_type, exception_type, exception_reason, handler, old_value, new_value, status, corrected_by, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    exceptions.forEach(e => excStmt.run(e.exception_no, e.related_id, e.related_type, e.exception_type, e.exception_reason, e.handler, e.old_value, e.new_value, e.status, e.corrected_by, e.corrected_at));
    excStmt.finalize();

    resolve();
  };
};

const initDb = async () => {
  try {
    console.log('开始创建数据表...');
    await createTables();
    console.log('数据表创建完成');
    
    console.log('开始插入示例数据...');
    await insertSampleData();
    console.log('示例数据插入完成');
    
    console.log('数据库初始化成功！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

initDb();
