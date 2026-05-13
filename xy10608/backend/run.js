
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'central_kitchen.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('✅ 数据库连接成功');

const now = new Date().toISOString();
const operator = '张三';

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
    is_optional INTEGER NOT NULL DEFAULT 0
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

console.log('✅ 数据库表初始化完成');

const recipeCount = db.prepare('SELECT COUNT(*) as c FROM menu_recipes').get().c;
if (recipeCount === 0) {
  const id = uuidv4;
  
  const r1id = id();
  db.prepare(`INSERT INTO menu_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    r1id, '招牌红烧肉', 'HM001', '热菜', '经典红烧肉，肥而不腻', 'approved', 1, operator, now, now
  );
  const r2id = id();
  db.prepare(`INSERT INTO menu_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    r2id, '清炒时蔬', 'HS002', '热菜', '新鲜时令蔬菜炒制', 'approved', 1, operator, now, now
  );
  const r3id = id();
  db.prepare(`INSERT INTO menu_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    r3id, '宫保鸡丁', 'CH003', '热菜', '经典川菜，鸡肉丁配花生米', 'approved', 1, operator, now, now
  );
  
  db.prepare(`INSERT INTO ingredient_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'PORK001', '五花肉', 'B20240501001', '中粮集团', '2024-05-01', '2024-05-08', 1000, 'kg', '', 'available', operator, now, now
  );
  db.prepare(`INSERT INTO ingredient_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'PEA001', '花生米', 'B20240501002', '山东花生公司', '2024-05-01', '2024-12-31', 500, 'kg', '花生', 'allergic', operator, now, now
  );
  db.prepare(`INSERT INTO ingredient_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'VEG001', '青菜', 'B20240502001', '本地蔬菜基地', '2024-05-02', '2024-05-05', 300, 'kg', '', 'expiring', operator, now, now
  );
  db.prepare(`INSERT INTO ingredient_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'CHK001', '鸡胸肉', 'B20240502002', '正大集团', '2024-05-02', '2024-05-15', 800, 'kg', '', 'available', operator, now, now
  );
  
  db.prepare(`INSERT INTO substitution_confirmations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'PORK001', '五花肉', 'PORK002', '瘦猪肉', null, null, '库存不足，临时用瘦猪肉替代', 'approved', '王五', now, operator, now, now
  );
  db.prepare(`INSERT INTO substitution_confirmations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'PEA001', '花生米', 'CAS001', '腰果', null, null, '存在花生过敏原风险，使用腰果替代', 'pending', null, null, operator, now, now
  );
  db.prepare(`INSERT INTO substitution_confirmations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'VEG001', '青菜', 'VEG002', '油麦菜', null, null, '青菜批次即将过期，使用油麦菜替代', 'rejected', '赵六', now, operator, now, now
  );
  
  db.prepare(`INSERT INTO allergen_restrictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'store001', '上海静安店', '花生', '严格禁止', '2024-05-01', '2024-12-31', 1, operator, now, now
  );
  db.prepare(`INSERT INTO allergen_restrictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'store003', '深圳南山店', '海鲜', '需标识', '2024-04-01', '2024-06-30', 1, operator, now, now
  );
  
  db.prepare(`INSERT INTO return_acceptances VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'RT20240503001', 'store002', '北京朝阳店', 'VEG001', '青菜', 'B20240502001', 20, 15, 'kg', '部分青菜发黄变质', 'approved', '钱七', now, operator, now, now
  );
  db.prepare(`INSERT INTO return_acceptances VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'RT20240503002', 'store001', '上海静安店', 'PORK001', '五花肉', 'B20240501001', 10, null, 'kg', '肉质新鲜度不够', 'pending', null, null, operator, now, now
  );
  
  db.prepare(`INSERT INTO store_costs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'TXN001', 'store001', '上海静安店', 'HM001', '招牌红烧肉', 'PORK002', '瘦猪肉', 5, 'kg', 35, 175, 'normal', '张三', now
  );
  db.prepare(`INSERT INTO store_costs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'TXN002', 'store003', '深圳南山店', 'CH003', '宫保鸡丁', 'PEA001', '花生米', 2, 'kg', 25, 50, 'blocked', '李四', now
  );
  db.prepare(`INSERT INTO store_costs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id(), 'TXN003', 'store002', '北京朝阳店', 'HS002', '清炒时蔬', 'VEG002', '油麦菜', 10, 'kg', 8, 80, 'revised', '王五', now
  );
  
  console.log('✅ 样例数据初始化完成');
} else {
  console.log('ℹ️ 数据库已有数据，跳过初始化');
}

module.exports = { db };

function logOperation(opType, module, recordId, action, details, op) {
  db.prepare(`INSERT INTO operation_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), opType, module, recordId, action, JSON.stringify(details), op, new Date().toISOString()
  );
}

function logChanges(module, recordId, oldObj, newObj, op) {
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  const t = new Date().toISOString();
  for (const key of allKeys) {
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      db.prepare(`INSERT INTO change_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uuidv4(), module, recordId, key, JSON.stringify(oldVal), JSON.stringify(newVal), op, t
      );
    }
  }
}

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/menu-recipes', (req, res) => {
  const recipes = db.prepare(`SELECT * FROM menu_recipes ORDER BY created_at DESC`).all();
  for (const r of recipes) {
    r.items = db.prepare(`SELECT * FROM menu_recipe_items WHERE recipe_id = ?`).all(r.id);
  }
  res.json(recipes);
});

app.get('/api/menu-recipes/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: '不存在' });
  r.items = db.prepare(`SELECT * FROM menu_recipe_items WHERE recipe_id = ?`).all(r.id);
  res.json(r);
});

app.post('/api/menu-recipes', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { menu_name, menu_code, category, description, items } = req.body;
  
  if (!menu_name || !menu_code || !category || !items || items.length === 0) {
    return res.status(400).json({ error: '参数缺失' });
  }
  
  try {
    db.prepare('BEGIN').run();
    const id = uuidv4();
    db.prepare(`INSERT INTO menu_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, menu_name, menu_code, category, description || '', 'draft', 1, op, t, t
    );
    for (const item of items) {
      db.prepare(`INSERT INTO menu_recipe_items VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        uuidv4(), id, item.ingredient_code, item.ingredient_name, item.quantity, item.unit, item.is_optional || 0
      );
    }
    logOperation('CREATE', 'menu_recipes', id, '创建菜单配方', { menu_name, menu_code }, op);
    db.prepare('COMMIT').run();
    res.status(201).json({ id, message: '创建成功' });
  } catch (e) {
    db.prepare('ROLLBACK').run();
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/menu-recipes/:id', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { menu_name, category, description, items, status } = req.body;
  
  const old = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  
  try {
    db.prepare('BEGIN').run();
    const updated = {
      menu_name: menu_name || old.menu_name,
      category: category || old.category,
      description: description !== undefined ? description : old.description,
      status: status || old.status,
      version: old.version + 1,
      updated_at: t
    };
    logChanges('menu_recipes', req.params.id, old, updated, op);
    db.prepare(`UPDATE menu_recipes SET menu_name = ?, category = ?, description = ?, status = ?, version = ?, updated_at = ? WHERE id = ?`).run(
      updated.menu_name, updated.category, updated.description, updated.status, updated.version, updated.updated_at, req.params.id
    );
    if (items) {
      db.prepare('DELETE FROM menu_recipe_items WHERE recipe_id = ?').run(req.params.id);
      for (const item of items) {
        db.prepare(`INSERT INTO menu_recipe_items VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), req.params.id, item.ingredient_code, item.ingredient_name, item.quantity, item.unit, item.is_optional || 0
        );
      }
    }
    logOperation('UPDATE', 'menu_recipes', req.params.id, '更新菜单配方', { menu_name: updated.menu_name }, op);
    db.prepare('COMMIT').run();
    res.json({ message: '更新成功' });
  } catch (e) {
    db.prepare('ROLLBACK').run();
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/menu-recipes/:id/approve', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const old = db.prepare('SELECT * FROM menu_recipes WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  db.prepare('UPDATE menu_recipes SET status = ?, updated_at = ? WHERE id = ?').run('approved', t, req.params.id);
  logChanges('menu_recipes', req.params.id, { status: old.status }, { status: 'approved' }, op);
  logOperation('APPROVE', 'menu_recipes', req.params.id, '审核通过', { menu_name: old.menu_name }, op);
  res.json({ message: '审核通过' });
});

app.get('/api/ingredient-batches', (req, res) => {
  res.json(db.prepare('SELECT * FROM ingredient_batches ORDER BY created_at DESC').all());
});

app.get('/api/ingredient-batches/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM ingredient_batches WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: '不存在' });
  res.json(b);
});

app.post('/api/ingredient-batches', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { ingredient_code, ingredient_name, batch_number, supplier, production_date, expiry_date, quantity, unit, allergens } = req.body;
  if (!ingredient_code || !ingredient_name || !batch_number || !supplier || !production_date || !expiry_date || quantity == null || !unit) {
    return res.status(400).json({ error: '参数缺失' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO ingredient_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, ingredient_code, ingredient_name, batch_number, supplier, production_date, expiry_date, quantity, unit, allergens || '', 'available', op, t, t
  );
  logOperation('CREATE', 'ingredient_batches', id, '创建批次', { ingredient_name, batch_number }, op);
  res.status(201).json({ id, message: '创建成功' });
});

app.put('/api/ingredient-batches/:id', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const old = db.prepare('SELECT * FROM ingredient_batches WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  
  const update = {};
  const fields = ['ingredient_code', 'ingredient_name', 'batch_number', 'supplier', 'production_date', 'expiry_date', 'quantity', 'unit', 'allergens', 'status'];
  for (const f of fields) {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  }
  update.updated_at = t;
  logChanges('ingredient_batches', req.params.id, old, update, op);
  
  const set = Object.keys(update).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(update), req.params.id];
  db.prepare(`UPDATE ingredient_batches SET ${set} WHERE id = ?`).run(...vals);
  logOperation('UPDATE', 'ingredient_batches', req.params.id, '更新批次', { ingredient_name: old.ingredient_name }, op);
  res.json({ message: '更新成功' });
});

app.get('/api/substitutions', (req, res) => {
  res.json(db.prepare('SELECT * FROM substitution_confirmations ORDER BY created_at DESC').all());
});

app.post('/api/substitutions', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { original_ingredient_code, original_ingredient_name, substitute_ingredient_code, substitute_ingredient_name, recipe_id, menu_name, reason } = req.body;
  if (!original_ingredient_code || !original_ingredient_name || !substitute_ingredient_code || !substitute_ingredient_name || !reason) {
    return res.status(400).json({ error: '参数缺失' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO substitution_confirmations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, original_ingredient_code, original_ingredient_name, substitute_ingredient_code, substitute_ingredient_name, recipe_id || null, menu_name || null, reason, 'pending', null, null, op, t, t
  );
  logOperation('CREATE', 'substitution_confirmations', id, '创建替代料', { original_ingredient_name, substitute_ingredient_name }, op);
  res.status(201).json({ id, message: '创建成功' });
});

app.post('/api/substitutions/:id/approve', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const old = db.prepare('SELECT * FROM substitution_confirmations WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  if (old.status !== 'pending') return res.status(400).json({ error: '已处理' });
  
  db.prepare(`UPDATE substitution_confirmations SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`).run(
    'approved', op, t, t, req.params.id
  );
  logChanges('substitution_confirmations', req.params.id, { status: old.status, approved_by: null }, { status: 'approved', approved_by: op }, op);
  logOperation('APPROVE', 'substitution_confirmations', req.params.id, '审核通过替代料', { original_ingredient_name: old.original_ingredient_name }, op);
  res.json({ message: '已通过' });
});

app.post('/api/substitutions/:id/reject', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const old = db.prepare('SELECT * FROM substitution_confirmations WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  if (old.status !== 'pending') return res.status(400).json({ error: '已处理' });
  
  db.prepare(`UPDATE substitution_confirmations SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`).run(
    'rejected', op, t, t, req.params.id
  );
  logChanges('substitution_confirmations', req.params.id, { status: old.status, approved_by: null }, { status: 'rejected', approved_by: op }, op);
  logOperation('REJECT', 'substitution_confirmations', req.params.id, '拒绝替代料', { original_ingredient_name: old.original_ingredient_name }, op);
  res.json({ message: '已拒绝' });
});

app.get('/api/allergen-restrictions', (req, res) => {
  res.json(db.prepare('SELECT * FROM allergen_restrictions ORDER BY created_at DESC').all());
});

app.post('/api/allergen-restrictions', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { store_id, store_name, allergen_type, restriction_level, effective_date, expiry_date, is_active } = req.body;
  if (!store_id || !store_name || !allergen_type || !restriction_level || !effective_date) {
    return res.status(400).json({ error: '参数缺失' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO allergen_restrictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, store_id, store_name, allergen_type, restriction_level, effective_date, expiry_date || null, is_active !== undefined ? is_active : 1, op, t, t
  );
  logOperation('CREATE', 'allergen_restrictions', id, '创建过敏原限制', { store_name, allergen_type }, op);
  res.status(201).json({ id, message: '创建成功' });
});

app.put('/api/allergen-restrictions/:id', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const old = db.prepare('SELECT * FROM allergen_restrictions WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  
  const update = {};
  const fields = ['store_id', 'store_name', 'allergen_type', 'restriction_level', 'effective_date', 'expiry_date', 'is_active'];
  for (const f of fields) {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  }
  update.updated_at = t;
  logChanges('allergen_restrictions', req.params.id, old, update, op);
  
  const set = Object.keys(update).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(update), req.params.id];
  db.prepare(`UPDATE allergen_restrictions SET ${set} WHERE id = ?`).run(...vals);
  logOperation('UPDATE', 'allergen_restrictions', req.params.id, '更新限制', { store_name: old.store_name }, op);
  res.json({ message: '更新成功' });
});

app.get('/api/return-acceptances', (req, res) => {
  res.json(db.prepare('SELECT * FROM return_acceptances ORDER BY created_at DESC').all());
});

app.post('/api/return-acceptances', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { return_number, store_id, store_name, ingredient_code, ingredient_name, batch_number, returned_quantity, unit, reason } = req.body;
  if (!return_number || !store_id || !store_name || !ingredient_code || !ingredient_name || !batch_number || returned_quantity == null || !unit || !reason) {
    return res.status(400).json({ error: '参数缺失' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO return_acceptances VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, return_number, store_id, store_name, ingredient_code, ingredient_name, batch_number, returned_quantity, null, unit, reason, 'pending', null, null, op, t, t
  );
  logOperation('CREATE', 'return_acceptances', id, '创建退料', { return_number, ingredient_name }, op);
  res.status(201).json({ id, message: '创建成功' });
});

app.post('/api/return-acceptances/:id/inspect', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { status, accepted_quantity } = req.body;
  if (!status) return res.status(400).json({ error: '状态必填' });
  
  const old = db.prepare('SELECT * FROM return_acceptances WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '不存在' });
  if (old.status !== 'pending') return res.status(400).json({ error: '已处理' });
  
  db.prepare(`UPDATE return_acceptances SET status = ?, accepted_quantity = ?, inspected_by = ?, inspected_at = ?, updated_at = ? WHERE id = ?`).run(
    status, accepted_quantity || null, op, t, t, req.params.id
  );
  logChanges('return_acceptances', req.params.id, 
    { status: old.status, accepted_quantity: null, inspected_by: null }, 
    { status, accepted_quantity: accepted_quantity || null, inspected_by: op }, op);
  logOperation('INSPECT', 'return_acceptances', req.params.id, '验收退料', { return_number: old.return_number, status }, op);
  res.json({ message: '验收完成' });
});

app.get('/api/store-costs', (req, res) => {
  let q = 'SELECT * FROM store_costs WHERE 1=1';
  const p = [];
  if (req.query.store_id) { q += ' AND store_id = ?'; p.push(req.query.store_id); }
  if (req.query.cost_type) { q += ' AND cost_type = ?'; p.push(req.query.cost_type); }
  if (req.query.created_by) { q += ' AND created_by = ?'; p.push(req.query.created_by); }
  q += ' ORDER BY created_at DESC';
  res.json(db.prepare(q).all(...p));
});

app.post('/api/store-costs', (req, res) => {
  const t = new Date().toISOString();
  const op = req.headers['x-operator'] || 'system';
  const { transaction_id, store_id, store_name, menu_code, menu_name, ingredient_code, ingredient_name, quantity, unit, unit_price, total_cost, cost_type } = req.body;
  
  if (!transaction_id || !store_id || !store_name || !ingredient_code || !ingredient_name || quantity == null || !unit || unit_price == null || total_cost == null || !cost_type) {
    return res.status(400).json({ error: '参数缺失' });
  }
  
  const existing = db.prepare('SELECT * FROM store_costs WHERE transaction_id = ?').get(transaction_id);
  if (existing) {
    console.log(`检测到重复请求: ${transaction_id}`);
    return res.json({ message: '重复请求，已跳过', isDuplicate: true, existingRecord: existing });
  }
  
  let shouldBlock = false;
  let blockReason = '';
  
  const allergenCheck = db.prepare(`SELECT * FROM allergen_restrictions WHERE store_id = ? AND is_active = 1`).all(store_id);
  const batchAllergens = db.prepare(`SELECT allergens FROM ingredient_batches WHERE ingredient_code = ? AND status != 'unavailable' ORDER BY created_at DESC LIMIT 1`).get(ingredient_code);
  
  if (batchAllergens && batchAllergens.allergens) {
    const list = batchAllergens.allergens.split(',').map(a => a.trim());
    for (const r of allergenCheck) {
      if (list.includes(r.allergen_type) && r.restriction_level === '严格禁止') {
        shouldBlock = true;
        blockReason = `食材含有过敏原 ${r.allergen_type}，该门店严格禁止使用`;
      }
    }
  }
  
  const finalType = shouldBlock ? 'blocked' : cost_type;
  const finalCost = shouldBlock ? 0 : total_cost;
  
  const id = uuidv4();
  db.prepare(`INSERT INTO store_costs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, transaction_id, store_id, store_name, menu_code || null, menu_name || null, ingredient_code, ingredient_name, quantity, unit, unit_price, finalCost, finalType, op, t
  );
  
  logOperation('CREATE', 'store_costs', id, '记录成本', { 
    store_name, ingredient_name, total_cost: finalCost, blocked: shouldBlock, blockReason 
  }, op);
  
  res.status(201).json({ 
    id, 
    message: shouldBlock ? '已记录（因过敏原限制已拦截）' : '记录成功',
    blocked: shouldBlock,
    blockReason
  });
});

app.get('/api/store-costs/stats', (req, res) => {
  res.json(db.prepare(`
    SELECT store_name, cost_type, COUNT(*) as count, SUM(total_cost) as total_amount
    FROM store_costs GROUP BY store_name, cost_type ORDER BY store_name, cost_type
  `).all());
});

app.get('/api/operations/logs', (req, res) => {
  let q = 'SELECT * FROM operation_logs WHERE 1=1';
  const p = [];
  if (req.query.module_name) { q += ' AND module_name = ?'; p.push(req.query.module_name); }
  if (req.query.operator) { q += ' AND operator = ?'; p.push(req.query.operator); }
  q += ' ORDER BY created_at DESC LIMIT 100';
  const logs = db.prepare(q).all(...p);
  for (const l of logs) {
    try { l.details = JSON.parse(l.details || '{}'); } catch(e) { l.details = {}; }
  }
  res.json(logs);
});

app.get('/api/operations/history/:module/:id', (req, res) => {
  const history = db.prepare('SELECT * FROM change_history WHERE module_name = ? AND record_id = ? ORDER BY changed_at DESC').all(req.params.module, req.params.id);
  for (const h of history) {
    try { h.old_value = JSON.parse(h.old_value || 'null'); } catch(e) { h.old_value = null; }
    try { h.new_value = JSON.parse(h.new_value || 'null'); } catch(e) { h.new_value = null; }
  }
  res.json(history);
});

app.get('/api/operations/pending-reviews', (req, res) => {
  const subs = db.prepare(`
    SELECT 'substitution' as type, id, original_ingredient_name as title, reason, created_at, created_by
    FROM substitution_confirmations WHERE status = 'pending' ORDER BY created_at DESC
  `).all();
  const rets = db.prepare(`
    SELECT 'return' as type, id, ingredient_name as title, reason, created_at, created_by
    FROM return_acceptances WHERE status = 'pending' ORDER BY created_at DESC
  `).all();
  const all = [...subs, ...rets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(all);
});

app.get('/api/operations/export', (req, res) => {
  const { operator, start_date, end_date, type } = req.query;
  const result = {};
  
  if (!type || type === 'all' || type === 'costs') {
    let q = 'SELECT * FROM store_costs WHERE 1=1';
    const p = [];
    if (operator) { q += ' AND created_by = ?'; p.push(operator); }
    if (start_date) { q += ' AND created_at >= ?'; p.push(start_date); }
    if (end_date) { q += ' AND created_at <= ?'; p.push(end_date + 'T23:59:59.999Z'); }
    q += ' ORDER BY created_at DESC';
    result.storeCosts = db.prepare(q).all(...p);
  }
  
  if (!type || type === 'all' || type === 'logs') {
    let q = 'SELECT * FROM operation_logs WHERE 1=1';
    const p = [];
    if (operator) { q += ' AND operator = ?'; p.push(operator); }
    if (start_date) { q += ' AND created_at >= ?'; p.push(start_date); }
    if (end_date) { q += ' AND created_at <= ?'; p.push(end_date + 'T23:59:59.999Z'); }
    q += ' ORDER BY created_at DESC';
    const logs = db.prepare(q).all(...p);
    for (const l of logs) {
      try { l.details = JSON.parse(l.details || '{}'); } catch(e) { l.details = {}; }
    }
    result.operationLogs = logs;
  }
  
  res.json({
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      filters: {
        operator: operator || '全部',
        startDate: start_date || '未指定',
        endDate: end_date || '未指定',
        type: type || '全部'
      }
    },
    ...result
  });
});

app.use((err, req, res, next) => {
  console.error('❌ 错误:', err);
  res.status(500).json({ error: '服务器错误' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 中央厨房领料替代系统');
  console.log('📍 后端 API: http://localhost:3000');
  console.log('✅ 健康检查: http://localhost:3000/api/health');
  console.log('');
  console.log('📖 可用 API:');
  console.log('  GET  /api/menu-recipes                    菜单配方列表');
  console.log('  POST /api/menu-recipes                    创建菜单配方');
  console.log('  GET  /api/ingredient-batches              食材批次列表');
  console.log('  GET  /api/substitutions                   替代料确认列表');
  console.log('  POST /api/substitutions/:id/approve       审核通过替代料');
  console.log('  POST /api/substitutions/:id/reject        拒绝替代料');
  console.log('  GET  /api/return-acceptances              退料验收列表');
  console.log('  POST /api/return-acceptances/:id/inspect  审核退料');
  console.log('  GET  /api/store-costs                     门店成本列表');
  console.log('  POST /api/store-costs                     记录成本（幂等）');
  console.log('  GET  /api/operations/logs                 操作日志');
  console.log('  GET  /api/operations/pending-reviews      待复核列表');
  console.log('  GET  /api/operations/export               数据导出');
  console.log('');
  console.log('💡 前端访问: 直接用浏览器打开 frontend/index.html');
  console.log('');
});

server.on('error', (err) => {
  console.error('❌ 服务器错误:', err);
  process.exit(1);
});

server.on('listening', () => {
  console.log('✅ 服务正在监听端口', PORT);
});

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    db.close();
    process.exit(0);
  });
});
