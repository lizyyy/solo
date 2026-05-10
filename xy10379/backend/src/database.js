const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'hotel_linen.db');
const db = new sqlite3.Database(dbPath);

db.run('PRAGMA foreign_keys = ON');

const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const initDatabase = async () => {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT UNIQUE NOT NULL,
      room_type TEXT NOT NULL,
      floor INTEGER,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS linen_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      unit TEXT DEFAULT '件',
      price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS linen_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_type_id INTEGER NOT NULL,
      total_quantity INTEGER DEFAULT 0,
      in_use_quantity INTEGER DEFAULT 0,
      damaged_quantity INTEGER DEFAULT 0,
      available_quantity INTEGER DEFAULT 0,
      FOREIGN KEY (linen_type_id) REFERENCES linen_types(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS room_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      guest_name TEXT,
      check_in_time DATETIME,
      check_out_time DATETIME,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS clean_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_order_id INTEGER NOT NULL,
      staff_id INTEGER,
      inspection_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      FOREIGN KEY (room_order_id) REFERENCES room_orders(id),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS damage_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_order_id INTEGER NOT NULL,
      linen_type_id INTEGER NOT NULL,
      reported_by_staff_id INTEGER,
      report_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      damage_level TEXT,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      is_repeat_check TEXT DEFAULT 'no',
      FOREIGN KEY (room_order_id) REFERENCES room_orders(id),
      FOREIGN KEY (linen_type_id) REFERENCES linen_types(id),
      FOREIGN KEY (reported_by_staff_id) REFERENCES staff(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS compensations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      damage_report_id INTEGER UNIQUE NOT NULL,
      room_order_id INTEGER NOT NULL,
      guest_name TEXT,
      amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      payment_time DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (damage_report_id) REFERENCES damage_reports(id),
      FOREIGN KEY (room_order_id) REFERENCES room_orders(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_type_id INTEGER NOT NULL,
      change_quantity INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      reference_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linen_type_id) REFERENCES linen_types(id)
    )
  `);

  const linenTypeCount = await getAsync('SELECT COUNT(*) as count FROM linen_types');
  if (linenTypeCount.count === 0) {
    const linenTypes = [
      ['床单', '条', 80],
      ['被套', '条', 150],
      ['枕套', '只', 30],
      ['浴巾', '条', 60],
      ['面巾', '条', 25]
    ];
    for (const [name, unit, price] of linenTypes) {
      await runAsync('INSERT INTO linen_types (name, unit, price) VALUES (?, ?, ?)', [name, unit, price]);
    }
  }

  const inventoryCount = await getAsync('SELECT COUNT(*) as count FROM linen_inventory');
  if (inventoryCount.count === 0) {
    const linenTypes = await allAsync('SELECT id FROM linen_types');
    for (let i = 0; i < linenTypes.length; i++) {
      const type = linenTypes[i];
      const baseQty = (i + 1) * 50;
      await runAsync(
        'INSERT INTO linen_inventory (linen_type_id, total_quantity, in_use_quantity, damaged_quantity, available_quantity) VALUES (?, ?, ?, ?, ?)',
        [type.id, baseQty, Math.floor(baseQty * 0.4), 5, Math.floor(baseQty * 0.5)]
      );
    }
  }

  const roomCount = await getAsync('SELECT COUNT(*) as count FROM rooms');
  if (roomCount.count === 0) {
    const rooms = [
      ['101', '标准间', 1, 'available'],
      ['102', '标准间', 1, 'available'],
      ['201', '大床房', 2, 'occupied'],
      ['202', '大床房', 2, 'available'],
      ['301', '套房', 3, 'occupied']
    ];
    for (const [num, type, floor, status] of rooms) {
      await runAsync('INSERT INTO rooms (room_number, room_type, floor, status) VALUES (?, ?, ?, ?)', [num, type, floor, status]);
    }
  }

  const staffCount = await getAsync('SELECT COUNT(*) as count FROM staff');
  if (staffCount.count === 0) {
    const staff = [
      ['张三', '清洁员', '13800138001'],
      ['李四', '清洁员', '13800138002'],
      ['王五', '客房主管', '13800138003'],
      ['赵六', '前厅主管', '13800138004']
    ];
    for (const [name, role, phone] of staff) {
      await runAsync('INSERT INTO staff (name, role, phone) VALUES (?, ?, ?)', [name, role, phone]);
    }
  }

  const orderCount = await getAsync('SELECT COUNT(*) as count FROM room_orders');
  if (orderCount.count === 0) {
    await runAsync('INSERT INTO room_orders (room_id, guest_name, check_in_time, status) VALUES (?, ?, ?, ?)', 
      [3, '王小明', '2026-05-10 14:00:00', 'open']);
    await runAsync('INSERT INTO room_orders (room_id, guest_name, check_in_time, status) VALUES (?, ?, ?, ?)', 
      [5, '李华', '2026-05-09 10:00:00', 'open']);
  }
};

module.exports = { db, initDatabase, runAsync, getAsync, allAsync };
