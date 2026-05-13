const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'bakery.db');
const db = new sqlite3.Database(dbPath);

const runSql = (sql) => new Promise((resolve, reject) => {
  db.exec(sql, (err) => err ? reject(err) : resolve());
});

const initTables = async () => {
  await runSql(`
    CREATE TABLE IF NOT EXISTS flavor_recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      ingredients TEXT NOT NULL,
      baking_time INTEGER NOT NULL,
      baking_temperature INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS flavor_recipe_versions (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      ingredients TEXT NOT NULL,
      baking_time INTEGER NOT NULL,
      baking_temperature INTEGER NOT NULL,
      version INTEGER NOT NULL,
      modified_by TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES flavor_recipes(id)
    );

    CREATE TABLE IF NOT EXISTS oven_capacities (
      id TEXT PRIMARY KEY,
      oven_name TEXT NOT NULL,
      max_batches INTEGER NOT NULL,
      batch_size INTEGER NOT NULL,
      available_hours TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS oven_capacity_versions (
      id TEXT PRIMARY KEY,
      capacity_id TEXT NOT NULL,
      oven_name TEXT NOT NULL,
      max_batches INTEGER NOT NULL,
      batch_size INTEGER NOT NULL,
      available_hours TEXT NOT NULL,
      version INTEGER NOT NULL,
      modified_by TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (capacity_id) REFERENCES oven_capacities(id)
    );

    CREATE TABLE IF NOT EXISTS ingredient_stocks (
      id TEXT PRIMARY KEY,
      ingredient_name TEXT NOT NULL,
      current_quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      min_threshold REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingredient_stock_versions (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      current_quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      min_threshold REAL NOT NULL,
      version INTEGER NOT NULL,
      modified_by TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (stock_id) REFERENCES ingredient_stocks(id)
    );

    CREATE TABLE IF NOT EXISTS production_shifts (
      id TEXT PRIMARY KEY,
      shift_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_orders INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      pickup_time TEXT NOT NULL,
      shift_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES flavor_recipes(id),
      FOREIGN KEY (shift_id) REFERENCES production_shifts(id)
    );

    CREATE TABLE IF NOT EXISTS reschedule_requests (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      original_pickup_time TEXT NOT NULL,
      requested_pickup_time TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      operation_time TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS order_timeline (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_description TEXT NOT NULL,
      operator TEXT NOT NULL,
      event_time TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  console.log('数据库表初始化完成');
};

const seedData = async () => {
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();

  const flavorCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM flavor_recipes', (err, row) => resolve(row.count));
  });

  if (flavorCount === 0) {
    const flavors = [
      { id: uuidv4(), name: '经典黄油曲奇', description: '酥脆可口的传统黄油曲奇', ingredients: '黄油:200g,低筋面粉:280g,糖粉:100g,鸡蛋:1个', baking_time: 15, baking_temperature: 180 },
      { id: uuidv4(), name: '巧克力布朗尼', description: '浓郁巧克力口感', ingredients: '黑巧克力:200g,黄油:150g,鸡蛋:3个,糖粉:150g,低筋面粉:80g', baking_time: 25, baking_temperature: 170 },
      { id: uuidv4(), name: '抹茶红豆蛋糕', description: '清新抹茶搭配红豆', ingredients: '抹茶粉:15g,低筋面粉:100g,鸡蛋:4个,细砂糖:80g,红豆:50g', baking_time: 30, baking_temperature: 160 },
      { id: uuidv4(), name: '芝士蛋糕', description: '浓郁芝士风味', ingredients: '奶油奶酪:250g,淡奶油:150ml,鸡蛋:2个,细砂糖:60g,消化饼干:100g', baking_time: 50, baking_temperature: 150 }
    ];

    const stmt = db.prepare('INSERT INTO flavor_recipes (id, name, description, ingredients, baking_time, baking_temperature, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const f of flavors) {
      await new Promise((resolve) => stmt.run(f.id, f.name, f.description, f.ingredients, f.baking_time, f.baking_temperature, now, now, resolve));
    }
    console.log('口味配方数据初始化完成');
  }

  const ovenCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM oven_capacities', (err, row) => resolve(row.count));
  });

  if (ovenCount === 0) {
    const ovens = [
      { id: uuidv4(), oven_name: '1号烤炉', max_batches: 8, batch_size: 50, available_hours: '08:00-20:00' },
      { id: uuidv4(), oven_name: '2号烤炉', max_batches: 6, batch_size: 30, available_hours: '08:00-18:00' },
      { id: uuidv4(), oven_name: '3号烤炉', max_batches: 10, batch_size: 80, available_hours: '06:00-22:00' }
    ];

    const stmt = db.prepare('INSERT INTO oven_capacities (id, oven_name, max_batches, batch_size, available_hours, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const o of ovens) {
      await new Promise((resolve) => stmt.run(o.id, o.oven_name, o.max_batches, o.batch_size, o.available_hours, now, now, resolve));
    }
    console.log('烤炉容量数据初始化完成');
  }

  const stockCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM ingredient_stocks', (err, row) => resolve(row.count));
  });

  if (stockCount === 0) {
    const stocks = [
      { id: uuidv4(), ingredient_name: '黄油', current_quantity: 5000, unit: 'g', min_threshold: 1000 },
      { id: uuidv4(), ingredient_name: '低筋面粉', current_quantity: 10000, unit: 'g', min_threshold: 2000 },
      { id: uuidv4(), ingredient_name: '糖粉', current_quantity: 3000, unit: 'g', min_threshold: 500 },
      { id: uuidv4(), ingredient_name: '鸡蛋', current_quantity: 200, unit: '个', min_threshold: 50 },
      { id: uuidv4(), ingredient_name: '黑巧克力', current_quantity: 2000, unit: 'g', min_threshold: 500 },
      { id: uuidv4(), ingredient_name: '抹茶粉', current_quantity: 500, unit: 'g', min_threshold: 100 },
      { id: uuidv4(), ingredient_name: '奶油奶酪', current_quantity: 3000, unit: 'g', min_threshold: 500 },
      { id: uuidv4(), ingredient_name: '淡奶油', current_quantity: 5000, unit: 'ml', min_threshold: 1000 }
    ];

    const stmt = db.prepare('INSERT INTO ingredient_stocks (id, ingredient_name, current_quantity, unit, min_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of stocks) {
      await new Promise((resolve) => stmt.run(s.id, s.ingredient_name, s.current_quantity, s.unit, s.min_threshold, now, now, resolve));
    }
    console.log('原料库存数据初始化完成');
  }

  const shiftCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM production_shifts', (err, row) => resolve(row.count));
  });

  if (shiftCount === 0) {
    const shifts = [
      { id: uuidv4(), shift_name: '早班', start_time: '06:00', end_time: '14:00', max_orders: 20 },
      { id: uuidv4(), shift_name: '中班', start_time: '14:00', end_time: '22:00', max_orders: 25 },
      { id: uuidv4(), shift_name: '晚班', start_time: '22:00', end_time: '06:00', max_orders: 10 }
    ];

    const stmt = db.prepare('INSERT INTO production_shifts (id, shift_name, start_time, end_time, max_orders, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of shifts) {
      await new Promise((resolve) => stmt.run(s.id, s.shift_name, s.start_time, s.end_time, s.max_orders, now, resolve));
    }
    console.log('生产班次数据初始化完成');
  }
};

(async () => {
  await initTables();
  await seedData();
  db.close();
  console.log('数据库初始化完成');
})();
