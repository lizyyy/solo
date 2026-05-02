const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bakery.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库表
function initDatabase() {
  // 商品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      unit TEXT DEFAULT '个',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 原料表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL DEFAULT 'g',
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 商品配方表 (商品-原料关系)
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
      UNIQUE (product_id, ingredient_id)
    );
  `);

  // 订单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      pickup_date TEXT NOT NULL,
      pickup_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '待确认',
      total_amount REAL DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 订单商品明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // 创建索引以提高查询性能
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);`);

  console.log('数据库初始化完成');
}

// 插入示例数据
function insertSampleData() {
  // 检查是否已有数据
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount > 0) {
    console.log('已有数据，跳过示例数据插入');
    return;
  }

  console.log('插入示例数据...');

  // 插入原料
  const insertIngredient = db.prepare(`
    INSERT INTO ingredients (name, unit, current_stock, min_stock)
    VALUES (@name, @unit, @current_stock, @min_stock)
  `);

  const ingredients = [
    { name: '面粉', unit: 'g', current_stock: 5000, min_stock: 1000 },
    { name: '鸡蛋', unit: '个', current_stock: 100, min_stock: 30 },
    { name: '奶油', unit: 'g', current_stock: 2000, min_stock: 500 },
    { name: '黄油', unit: 'g', current_stock: 1500, min_stock: 300 },
    { name: '白砂糖', unit: 'g', current_stock: 3000, min_stock: 500 },
    { name: '牛奶', unit: 'ml', current_stock: 2000, min_stock: 500 },
    { name: '可可粉', unit: 'g', current_stock: 500, min_stock: 100 },
    { name: '巧克力', unit: 'g', current_stock: 800, min_stock: 200 },
  ];

  const ingredientIds = {};
  for (const ing of ingredients) {
    const result = insertIngredient.run(ing);
    ingredientIds[ing.name] = result.lastInsertRowid;
  }

  // 插入商品
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, unit)
    VALUES (@name, @description, @unit)
  `);

  const products = [
    { name: '原味戚风蛋糕', description: '6寸，经典口味', unit: '个' },
    { name: '巧克力蛋糕', description: '6寸，浓郁巧克力风味', unit: '个' },
    { name: '奶油泡芙', description: '6个装，香草内馅', unit: '盒' },
    { name: '吐司面包', description: '全麦吐司', unit: '条' },
    { name: '曲奇饼干', description: '黄油曲奇，200g装', unit: '盒' },
  ];

  const productIds = {};
  for (const prod of products) {
    const result = insertProduct.run(prod);
    productIds[prod.name] = result.lastInsertRowid;
  }

  // 插入配方
  const insertRecipe = db.prepare(`
    INSERT INTO recipes (product_id, ingredient_id, quantity)
    VALUES (@product_id, @ingredient_id, @quantity)
  `);

  const recipes = [
    // 原味戚风蛋糕配方
    { product: '原味戚风蛋糕', ingredient: '面粉', quantity: 100 },
    { product: '原味戚风蛋糕', ingredient: '鸡蛋', quantity: 4 },
    { product: '原味戚风蛋糕', ingredient: '白砂糖', quantity: 80 },
    { product: '原味戚风蛋糕', ingredient: '牛奶', quantity: 50 },
    { product: '原味戚风蛋糕', ingredient: '黄油', quantity: 30 },
    
    // 巧克力蛋糕配方
    { product: '巧克力蛋糕', ingredient: '面粉', quantity: 80 },
    { product: '巧克力蛋糕', ingredient: '鸡蛋', quantity: 3 },
    { product: '巧克力蛋糕', ingredient: '可可粉', quantity: 30 },
    { product: '巧克力蛋糕', ingredient: '白砂糖', quantity: 70 },
    { product: '巧克力蛋糕', ingredient: '黄油', quantity: 40 },
    { product: '巧克力蛋糕', ingredient: '巧克力', quantity: 50 },
    
    // 奶油泡芙配方
    { product: '奶油泡芙', ingredient: '面粉', quantity: 120 },
    { product: '奶油泡芙', ingredient: '鸡蛋', quantity: 4 },
    { product: '奶油泡芙', ingredient: '黄油', quantity: 80 },
    { product: '奶油泡芙', ingredient: '牛奶', quantity: 150 },
    { product: '奶油泡芙', ingredient: '奶油', quantity: 200 },
    { product: '奶油泡芙', ingredient: '白砂糖', quantity: 30 },
    
    // 吐司面包配方
    { product: '吐司面包', ingredient: '面粉', quantity: 300 },
    { product: '吐司面包', ingredient: '鸡蛋', quantity: 1 },
    { product: '吐司面包', ingredient: '黄油', quantity: 30 },
    { product: '吐司面包', ingredient: '白砂糖', quantity: 40 },
    { product: '吐司面包', ingredient: '牛奶', quantity: 180 },
    
    // 曲奇饼干配方
    { product: '曲奇饼干', ingredient: '面粉', quantity: 200 },
    { product: '曲奇饼干', ingredient: '鸡蛋', quantity: 1 },
    { product: '曲奇饼干', ingredient: '黄油', quantity: 150 },
    { product: '曲奇饼干', ingredient: '白砂糖', quantity: 80 },
  ];

  for (const recipe of recipes) {
    insertRecipe.run({
      product_id: productIds[recipe.product],
      ingredient_id: ingredientIds[recipe.ingredient],
      quantity: recipe.quantity
    });
  }

  // 插入示例订单
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_no, customer_name, customer_phone, pickup_date, pickup_time, status, remark)
    VALUES (@order_no, @customer_name, @customer_phone, @pickup_date, @pickup_time, @status, @remark)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (@order_id, @product_id, @quantity, @unit_price)
  `);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const orders = [
    {
      order_no: 'ORD20260501001',
      customer_name: '张女士',
      customer_phone: '13800138001',
      pickup_date: today,
      pickup_time: '10:00',
      status: '已确认',
      remark: '需要蜡烛',
      items: [
        { product: '原味戚风蛋糕', quantity: 2, unit_price: 88 },
      ]
    },
    {
      order_no: 'ORD20260501002',
      customer_name: '李先生',
      customer_phone: '13800138002',
      pickup_date: today,
      pickup_time: '14:00',
      status: '待确认',
      remark: '',
      items: [
        { product: '巧克力蛋糕', quantity: 1, unit_price: 128 },
        { product: '曲奇饼干', quantity: 2, unit_price: 38 },
      ]
    },
    {
      order_no: 'ORD20260501003',
      customer_name: '王小姐',
      customer_phone: '13800138003',
      pickup_date: tomorrow,
      pickup_time: '09:00',
      status: '已确认',
      remark: '少糖',
      items: [
        { product: '奶油泡芙', quantity: 3, unit_price: 45 },
        { product: '吐司面包', quantity: 2, unit_price: 28 },
      ]
    },
  ];

  for (const order of orders) {
    const { items, ...orderData } = order;
    const result = insertOrder.run(orderData);
    const orderId = result.lastInsertRowid;
    
    for (const item of items) {
      insertOrderItem.run({
        order_id: orderId,
        product_id: productIds[item.product],
        quantity: item.quantity,
        unit_price: item.unit_price
      });
    }
  }

  console.log('示例数据插入完成');
}

initDatabase();
insertSampleData();

module.exports = db;
