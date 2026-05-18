const db = require('../config/database');

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS rental_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        tent_model TEXT NOT NULL,
        tent_size TEXT NOT NULL,
        rental_start_date TEXT NOT NULL,
        rental_end_date TEXT NOT NULL,
        rental_days INTEGER NOT NULL,
        rental_fee REAL NOT NULL,
        deposit REAL NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS compensation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compensation_no TEXT UNIQUE NOT NULL,
        order_no TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        tent_model TEXT NOT NULL,
        return_date TEXT NOT NULL,
        check_person TEXT NOT NULL,
        main_component_damage TEXT,
        main_damage_level TEXT,
        main_damage_description TEXT,
        main_compensation_amount REAL,
        accessory_missing TEXT,
        missing_accessory_list TEXT,
        accessory_compensation_amount REAL,
        total_compensation_amount REAL NOT NULL,
        compensation_status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_time TEXT,
        remarks TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_no) REFERENCES rental_orders(order_no)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS compensation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compensation_no TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (compensation_no) REFERENCES compensation_records(compensation_no)
      )`);

      console.log('数据库表创建完成');
      resolve();
    });
  });
};

const insertSampleData = () => {
  return new Promise((resolve, reject) => {
    const sampleOrders = [
      {
        order_no: 'ORD20240501001',
        customer_name: '张三',
        customer_phone: '13800138001',
        tent_model: '牧高笛冷山2',
        tent_size: '双人',
        rental_start_date: '2024-05-01',
        rental_end_date: '2024-05-03',
        rental_days: 3,
        rental_fee: 150.00,
        deposit: 500.00,
        status: 'completed'
      },
      {
        order_no: 'ORD20240502001',
        customer_name: '李四',
        customer_phone: '13900139001',
        tent_model: '凯乐石星空3',
        tent_size: '三人',
        rental_start_date: '2024-05-02',
        rental_end_date: '2024-05-05',
        rental_days: 4,
        rental_fee: 240.00,
        deposit: 800.00,
        status: 'completed'
      },
      {
        order_no: 'ORD20240503001',
        customer_name: '王五',
        customer_phone: '13700137001',
        tent_model: '北面VE25',
        tent_size: '四人',
        rental_start_date: '2024-05-03',
        rental_end_date: '2024-05-06',
        rental_days: 4,
        rental_fee: 400.00,
        deposit: 1200.00,
        status: 'completed'
      }
    ];

    const orderStmt = db.prepare(`INSERT OR IGNORE INTO rental_orders 
      (order_no, customer_name, customer_phone, tent_model, tent_size, 
       rental_start_date, rental_end_date, rental_days, rental_fee, deposit, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    sampleOrders.forEach(order => {
      orderStmt.run(
        order.order_no, order.customer_name, order.customer_phone,
        order.tent_model, order.tent_size, order.rental_start_date,
        order.rental_end_date, order.rental_days, order.rental_fee,
        order.deposit, order.status
      );
    });
    orderStmt.finalize();

    const sampleCompensations = [
      {
        compensation_no: 'COMP20240504001',
        order_no: 'ORD20240501001',
        customer_name: '张三',
        customer_phone: '13800138001',
        tent_model: '牧高笛冷山2',
        return_date: '2024-05-04',
        check_person: '赵管理员',
        main_component_damage: 'none',
        main_damage_level: null,
        main_damage_description: null,
        main_compensation_amount: 0,
        accessory_missing: 'yes',
        missing_accessory_list: '地钉x3,防风绳x2',
        accessory_compensation_amount: 80.00,
        total_compensation_amount: 80.00,
        compensation_status: 'paid',
        payment_method: '微信支付',
        payment_time: '2024-05-04 15:30:00',
        remarks: '客户承认丢失，已从押金扣除',
        version: 1
      }
    ];

    const compStmt = db.prepare(`INSERT OR IGNORE INTO compensation_records 
      (compensation_no, order_no, customer_name, customer_phone, tent_model, 
       return_date, check_person, main_component_damage, main_damage_level,
       main_damage_description, main_compensation_amount, accessory_missing,
       missing_accessory_list, accessory_compensation_amount, 
       total_compensation_amount, compensation_status, payment_method, 
       payment_time, remarks, version) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    sampleCompensations.forEach(comp => {
      compStmt.run(
        comp.compensation_no, comp.order_no, comp.customer_name,
        comp.customer_phone, comp.tent_model, comp.return_date,
        comp.check_person, comp.main_component_damage, comp.main_damage_level,
        comp.main_damage_description, comp.main_compensation_amount,
        comp.accessory_missing, comp.missing_accessory_list,
        comp.accessory_compensation_amount, comp.total_compensation_amount,
        comp.compensation_status, comp.payment_method, comp.payment_time,
        comp.remarks, comp.version
      );
    });
    compStmt.finalize();

    const sampleItems = [
      {
        compensation_no: 'COMP20240504001',
        item_type: 'accessory',
        item_name: '地钉',
        quantity: 3,
        unit_price: 15.00,
        subtotal: 45.00,
        reason: '丢失'
      },
      {
        compensation_no: 'COMP20240504001',
        item_type: 'accessory',
        item_name: '防风绳',
        quantity: 2,
        unit_price: 17.50,
        subtotal: 35.00,
        reason: '丢失'
      }
    ];

    const itemStmt = db.prepare(`INSERT OR IGNORE INTO compensation_items 
      (compensation_no, item_type, item_name, quantity, unit_price, subtotal, reason) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    sampleItems.forEach(item => {
      itemStmt.run(
        item.compensation_no, item.item_type, item.item_name,
        item.quantity, item.unit_price, item.subtotal, item.reason
      );
    });
    itemStmt.finalize();

    console.log('样例数据插入完成');
    resolve();
  });
};

const init = async () => {
  try {
    await createTables();
    await insertSampleData();
    db.close();
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
};

init();
