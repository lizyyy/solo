
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库
const Database = require('better-sqlite3');
const dbPath = path.join(dataDir, 'central_kitchen.db');
const db = new Database(dbPath);

console.log('数据库连接成功');

// 初始化数据库表
db.pragma('journal_mode = WAL');

// 创建表
function createTables();

// 初始化样例数据
seedSampleData();

// 导入路由模块
const menuRecipesRouter = require('./src/routes/menuRecipes');
const ingredientBatchesRouter = require('./src/routes/ingredientBatches');
const substitutionsRouter = require('./src/routes/substitutions');
const allergenRestrictionsRouter = require('./src/routes/allergenRestrictions');
const returnAcceptancesRouter = require('./src/routes/returnAcceptances');
const storeCostsRouter = require('./src/routes/storeCosts');
const operationsRouter = require('./src/routes/operations');

// 重新导出 db
module.exports = { db };

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/menu-recipes', menuRecipesRouter);
app.use('/api/ingredient-batches', ingredientBatchesRouter);
app.use('/api/substitutions', substitutionsRouter);
app.use('/api/allergen-restrictions', allergenRestrictionsRouter);
app.use('/api/return-acceptances', returnAcceptancesRouter);
app.use('/api/store-costs', storeCostsRouter);
app.use('/api/operations', operationsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动
app.listen(PORT, () => {
  console.log(`🚀 中央厨房系统后端服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`✅ 健康检查: http://localhost:${PORT}/api/health`);
});

function createTables() {
  // 菜单配方表
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_recipes (
      id TEXT PRIMARY KEY,
      menu_name TEXT NOT NULL,
      menu_code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_recipe_items (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      is_optional INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (recipe_id) REFERENCES menu_recipes(id)
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredient_batches (
      id TEXT PRIMARY KEY,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      batch_number TEXT UNIQUE NOT NULL,
      supplier TEXT NOT NULL,
      production_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      allergens TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS substitution_confirmations (
      id TEXT PRIMARY KEY,
      original_ingredient_code TEXT NOT NULL,
      original_ingredient_name TEXT NOT NULL,
      substitute_ingredient_code TEXT NOT NULL,
      substitute_ingredient_name TEXT NOT NULL,
      recipe_id TEXT,
      menu_name TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS allergen_restrictions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      allergen_type TEXT NOT NULL,
      restriction_level TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      expiry_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS return_acceptances (
      id TEXT PRIMARY KEY,
      return_number TEXT UNIQUE NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      returned_quantity REAL NOT NULL,
      accepted_quantity REAL,
      unit TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      inspected_by TEXT,
      inspected_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_costs (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      menu_code TEXT,
      menu_name TEXT,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      total_cost REAL NOT NULL,
      cost_type TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      module_name TEXT NOT NULL,
      record_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_history (
      id TEXT PRIMARY KEY,
      module_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_records (
      id TEXT PRIMARY KEY,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      review_action TEXT NOT NULL,
      review_comment TEXT,
      review_status TEXT NOT NULL,
      reviewed_at TEXT NOT NULL
    );
  `);
  
  console.log('数据库表初始化完成');
}

function seedSampleData() {
  const { v4: uuidv4 } = require('uuid');
  
  const now = new Date().toISOString();
  const operator = '张三';
  
  // 检查是否已有数据
  const count = db.prepare('SELECT COUNT(*) as c FROM menu_recipes').get().c;
  if (count > 0) {
    console.log('数据库已有数据，跳过初始化');
    return;
  }
  
  const id = uuidv4;
  
  // 菜单配方
  const recipes = [
    { menu_name: '招牌红烧肉', menu_code: 'HM001', category: '热菜', description: '经典红烧肉' },
    { menu_name: '清炒时蔬', menu_code: 'HS002', category: '热菜', description: '新鲜时令蔬菜' },
    { menu_name: '宫保鸡丁', menu_code: 'CH003', category: '热菜', description: '经典川菜' }
  ];
  
  for (const r of recipes) {
    const rid = id();
    db.prepare(`INSERT INTO menu_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      rid, r.menu_name, r.menu_code, r.category, r.description, 'approved', 1, operator, now, now
    );
  }
  
  // 食材批次
  const batches = [
    { code: 'PORK001', name: '五花肉', batch: 'B20240501001', supplier: '中粮集团', prod: '2024-05-01', exp: '2024-05-08', qty: 1000, unit: 'kg', allergens: '', status: 'available' },
    { code: 'PEA001', name: '花生米', batch: 'B20240501002', supplier: '山东花生公司', prod: '2024-05-01', exp: '2024-12-31', qty: 500, unit: 'kg', allergens: '花生', status: 'allergic' },
    { code: 'VEG001', name: '青菜', batch: 'B20240502001', supplier: '本地蔬菜基地', prod: '2024-05-02', exp: '2024-05-05', qty: 300, unit: 'kg', allergens: '', status: 'expiring' },
    { code: 'CHK001', name: '鸡胸肉', batch: 'B20240502002', supplier: '正大集团', prod: '2024-05-02', exp: '2024-05-15', qty: 800, unit: 'kg', allergens: '', status: 'available' }
  ];
  
  for (const b of batches) {
    db.prepare(`INSERT INTO ingredient_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id(), b.code, b.name, b.batch, b.supplier, b.prod, b.exp, b.qty, b.unit, b.allergens, b.status, operator, now, now
    );
  }
  
  // 替代料确认
  const subs = [
    { ocode: 'PORK001', oname: '五花肉', scode: 'PORK002', sname: '瘦猪肉', reason: '库存不足', status: 'approved', approved: '王五' },
    { ocode: 'PEA001', oname: '花生米', scode: 'CAS001', sname: '腰果', reason: '含过敏原', status: 'pending', approved: null },
    { ocode: 'VEG001', oname: '青菜', scode: 'VEG002', sname: '油麦菜', reason: '即将过期', status: 'rejected', approved: '赵六' }
  ];
  
  for (const s of subs) {
    db.prepare(`INSERT INTO substitution_confirmations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id(), s.ocode, s.oname, s.scode, s.sname, null, null, s.reason, s.status, s.approved, s.approved ? now : null, operator, now, now
    );
  }
  
  // 过敏原限制
  const allergens = [
    { store: 'store001', sname: '上海静安店', type: '花生', level: '严格禁止', start: '2024-05-01', end: '2024-12-31', active: 1 },
    { store: 'store003', sname: '深圳南山店', type: '海鲜', level: '需标识', start: '2024-04-01', end: '2024-06-30', active: 1 }
  ];
  
  for (const a of allergens) {
    db.prepare(`INSERT INTO allergen_restrictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id(), a.store, a.sname, a.type, a.level, a.start, a.end, a.active, operator, now, now
    );
  }
  
  // 退料验收
  const returns = [
    { rn: 'RT20240503001', store: 'store002', sname: '北京朝阳店', code: 'VEG001', name: '青菜', batch: 'B20240502001', rqty: 20, aqty: 15, unit: 'kg', reason: '部分变质', status: 'approved', inspector: '钱七' },
    { rn: 'RT20240503002', store: 'store001', sname: '上海静安店', code: 'PORK001', name: '五花肉', batch: 'B20240501001', rqty: 10, aqty: null, unit: 'kg', reason: '新鲜度不够', status: 'pending', inspector: null }
  ];
  
  for (const r of returns) {
    db.prepare(`INSERT INTO return_acceptances VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id(), r.rn, r.store, r.sname, r.code, r.name, r.batch, r.rqty, r.aqty, r.unit, r.reason, r.status, r.inspector, r.inspector ? now : null, operator, now, now
    );
  }
  
  // 门店成本
  const costs = [
    { txn: 'TXN001', store: 'store001', sname: '上海静安店', mcode: 'HM001', mname: '招牌红烧肉', code: 'PORK002', name: '瘦猪肉', qty: 5, unit: 'kg', price: 35, total: 175, type: 'normal', by: '张三' },
    { txn: 'TXN002', store: 'store003', sname: '深圳南山店', mcode: 'CH003', mname: '宫保鸡丁', code: 'PEA001', name: '花生米', qty: 2, unit: 'kg', price: 25, total: 50, type: 'blocked', by: '李四' },
    { txn: 'TXN003', store: 'store002', sname: '北京朝阳店', mcode: 'HS002', mname: '清炒时蔬', code: 'VEG002', name: '油麦菜', qty: 10, unit: 'kg', price: 8, total: 80, type: 'revised', by: '王五' }
  ];
  
  for (const c of costs) {
    db.prepare(`INSERT INTO store_costs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id(), c.txn, c.store, c.sname, c.mcode, c.mname, c.code, c.name, c.qty, c.unit, c.price, c.total, c.type, c.by, now
    );
  }
  
  console.log('✅ 样例数据初始化完成');
}
