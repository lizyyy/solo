const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function decodeOperator(req) {
  const op = req.headers['x-operator'];
  if (!op) return 'system';
  try {
    return decodeURIComponent(op);
  } catch {
    return op;
  }
}

function logAction(action, targetType, targetId, details, operator = 'system', source = 'web') {
  const stmt = db.prepare(`
    INSERT INTO audit_log (action, target_type, target_id, details, operator, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(action, targetType, targetId, JSON.stringify(details), operator, source);
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
}

app.get('/api/donors', (req, res) => {
  const donors = db.prepare('SELECT * FROM donors ORDER BY created_at DESC').all();
  res.json(donors);
});

app.post('/api/donors', (req, res) => {
  const { name, phone, type } = req.body;
  const operator = decodeOperator(req);
  const stmt = db.prepare('INSERT INTO donors (name, phone, type) VALUES (?, ?, ?)');
  const result = stmt.run(name, phone, type);
  logAction('create', 'donor', result.lastInsertRowid, { name, phone, type }, operator);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM food_categories').all();
  res.json(categories);
});

app.get('/api/foods', (req, res) => {
  const today = getToday();
  const foods = db.prepare(`
    SELECT f.*, d.name as donor_name, c.name as category_name,
      CASE
        WHEN f.expiry_date < ? THEN 'expired'
        WHEN julianday(f.expiry_date) - julianday(?) <= 3 AND julianday(f.expiry_date) - julianday(?) >= 0 THEN 'near_expiry'
        ELSE f.status
      END as effective_status
    FROM foods f
    LEFT JOIN donors d ON f.donor_id = d.id
    LEFT JOIN food_categories c ON f.category_id = c.id
    ORDER BY f.created_at DESC
  `).all(today, today, today);
  
  const foodsWithStock = foods.map(f => {
    const pickupCount = db.prepare('SELECT COALESCE(SUM(quantity), 0) as picked FROM pickups WHERE food_id = ?').get(f.id).picked;
    return { ...f, stock: f.quantity - pickupCount };
  });
  
  res.json(foodsWithStock);
});

app.post('/api/foods', (req, res) => {
  const { batch_no, name, category_id, donor_id, quantity, unit, expiry_date } = req.body;
  const operator = decodeOperator(req);
  const today = getToday();
  
  if (expiry_date < today) {
    logAction('reject', 'food', null, { batch_no, name, reason: '过期食品禁止上架', expiry_date }, operator);
    return res.status(400).json({ error: '过期食品禁止上架' });
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO foods (batch_no, name, category_id, donor_id, quantity, unit, expiry_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
    `);
    const result = stmt.run(batch_no, name, category_id, donor_id, quantity, unit, expiry_date);
    
    const approvedStmt = db.prepare(`
      UPDATE foods SET approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    approvedStmt.run(operator, result.lastInsertRowid);
    
    logAction('add', 'food', result.lastInsertRowid, { batch_no, name, quantity, expiry_date }, operator);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '批次号已存在' });
    }
    throw e;
  }
});

app.post('/api/foods/:id/offline', (req, res) => {
  const { reason } = req.body;
  const operator = decodeOperator(req);
  const foodId = req.params.id;
  
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId);
  if (!food) return res.status(404).json({ error: '食品不存在' });
  
  const stmt = db.prepare("UPDATE foods SET status = 'offline' WHERE id = ?");
  stmt.run(foodId);
  
  logAction('offline', 'food', foodId, { reason, original_status: food.status }, operator);
  res.json({ success: true });
});

app.post('/api/foods/:id/damage', (req, res) => {
  const { reason, quantity } = req.body;
  const operator = decodeOperator(req);
  const foodId = req.params.id;
  
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId);
  if (!food) return res.status(404).json({ error: '食品不存在' });
  
  const stmt = db.prepare(`
    INSERT INTO pickups (food_id, resident_name, quantity, processed_by)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(foodId, '[报损]', quantity, operator);
  
  logAction('damage', 'food', foodId, { reason, quantity }, operator);
  res.json({ success: true });
});

app.post('/api/pickups', (req, res) => {
  const { food_id, resident_name, resident_phone, quantity } = req.body;
  const operator = decodeOperator(req);
  const today = getToday();
  
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(food_id);
  if (!food) return res.status(404).json({ error: '食品不存在' });
  
  if (food.status === 'offline') {
    logAction('reject_pickup', 'food', food_id, { reason: '食品已下架', resident_name, quantity }, operator);
    return res.status(400).json({ error: '该食品已下架，无法领取' });
  }
  
  if (food.expiry_date < today) {
    logAction('reject_pickup', 'food', food_id, { reason: '食品已过期', resident_name, quantity }, operator);
    return res.status(400).json({ error: '该食品已过期，无法领取' });
  }
  
  const pickedToday = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM pickups
    WHERE food_id = ? AND resident_name = ? AND DATE(pickup_time) = ?
  `).get(food_id, resident_name, today).total;
  
  if (pickedToday + quantity > 2) {
    logAction('reject_pickup', 'food', food_id, { reason: '单日领取超量', resident_name, quantity, already_picked: pickedToday }, operator);
    return res.status(400).json({ error: '同一批次食品每人每天最多领取2份' });
  }
  
  const totalPicked = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM pickups WHERE food_id = ?').get(food_id).total;
  
  if (totalPicked + quantity > food.quantity) {
    logAction('reject_pickup', 'food', food_id, { reason: '库存不足', resident_name, quantity, stock: food.quantity - totalPicked }, operator);
    return res.status(400).json({ error: `库存不足，剩余 ${food.quantity - totalPicked} 份` });
  }
  
  const stmt = db.prepare(`
    INSERT INTO pickups (food_id, resident_name, resident_phone, quantity, processed_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(food_id, resident_name, resident_phone, quantity, operator);
  
  logAction('pickup', 'pickup', result.lastInsertRowid, { food_id, resident_name, quantity, batch_no: food.batch_no }, operator);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/pickups', (req, res) => {
  const pickups = db.prepare(`
    SELECT p.*, f.name as food_name, f.batch_no, d.name as donor_name
    FROM pickups p
    LEFT JOIN foods f ON p.food_id = f.id
    LEFT JOIN donors d ON f.donor_id = d.id
    ORDER BY p.pickup_time DESC
    LIMIT 100
  `).all();
  res.json(pickups);
});

app.get('/api/alerts', (req, res) => {
  const today = getToday();
  const alerts = db.prepare(`
    SELECT f.*, d.name as donor_name,
      julianday(f.expiry_date) - julianday(?) as days_left
    FROM foods f
    LEFT JOIN donors d ON f.donor_id = d.id
    WHERE f.status != 'offline'
      AND julianday(f.expiry_date) - julianday(?) <= 3
    ORDER BY days_left ASC
  `).all(today, today);
  
  const alertsWithStock = alerts.map(f => {
    const pickupCount = db.prepare('SELECT COALESCE(SUM(quantity), 0) as picked FROM pickups WHERE food_id = ?').get(f.id).picked;
    return { ...f, stock: f.quantity - pickupCount };
  });
  
  res.json(alertsWithStock);
});

app.get('/api/logs', (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200
  `).all();
  res.json(logs.map(l => ({
    ...l,
    details: JSON.parse(l.details || '{}')
  })));
});

app.get('/api/stats', (req, res) => {
  const totalFoods = db.prepare('SELECT COUNT(*) as count FROM foods').get().count;
  const availableFoods = db.prepare("SELECT COUNT(*) as count FROM foods WHERE status = 'available'").get().count;
  const totalDonors = db.prepare('SELECT COUNT(*) as count FROM donors').get().count;
  const totalPickups = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM pickups WHERE resident_name != ?').get('[报损]').total;
  const totalDamaged = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM pickups WHERE resident_name = ?').get('[报损]').total;
  
  const today = getToday();
  const expiredCount = db.prepare(`
    SELECT COUNT(*) as count FROM foods WHERE status != 'offline' AND expiry_date < ?
  `).get(today).count;
  
  const nearExpiryCount = db.prepare(`
    SELECT COUNT(*) as count FROM foods 
    WHERE status != 'offline' 
      AND expiry_date >= ? 
      AND julianday(expiry_date) - julianday(?) <= 3
  `).get(today, today).count;
  
  const donorRanking = db.prepare(`
    SELECT d.name, COUNT(f.id) as food_count, COALESCE(SUM(f.quantity), 0) as total_quantity
    FROM donors d
    LEFT JOIN foods f ON d.id = f.donor_id
    GROUP BY d.id
    ORDER BY total_quantity DESC
    LIMIT 5
  `).all();
  
  const categoryStats = db.prepare(`
    SELECT c.name, COUNT(f.id) as food_count
    FROM food_categories c
    LEFT JOIN foods f ON c.id = f.category_id
    GROUP BY c.id
  `).all();
  
  res.json({
    summary: {
      totalFoods,
      availableFoods,
      totalDonors,
      totalPickups,
      totalDamaged,
      expiredCount,
      nearExpiryCount
    },
    donorRanking,
    categoryStats
  });
});

app.get('/api/export', (req, res) => {
  const foods = db.prepare(`
    SELECT f.id, f.batch_no, f.name, f.quantity, f.unit, f.expiry_date, f.status,
      f.created_at, f.approved_at, f.approved_by,
      d.name as donor_name, d.phone as donor_phone, d.type as donor_type,
      c.name as category_name
    FROM foods f
    LEFT JOIN donors d ON f.donor_id = d.id
    LEFT JOIN food_categories c ON f.category_id = c.id
    ORDER BY f.created_at DESC
  `).all();
  
  const pickups = db.prepare(`
    SELECT p.id, p.resident_name, p.resident_phone, p.quantity, p.pickup_time, p.processed_by,
      f.name as food_name, f.batch_no, d.name as donor_name
    FROM pickups p
    LEFT JOIN foods f ON p.food_id = f.id
    LEFT JOIN donors d ON f.donor_id = d.id
    ORDER BY p.pickup_time DESC
  `).all();
  
  const logs = db.prepare(`
    SELECT id, action, target_type, target_id, details, operator, source, created_at
    FROM audit_log ORDER BY created_at DESC
  `).all().map(l => ({
    ...l,
    details: JSON.parse(l.details || '{}')
  }));
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=fridge-export-${Date.now()}.json`);
  res.json({
    exportTime: new Date().toISOString(),
    foods,
    pickups,
    logs
  });
});

app.listen(PORT, () => {
  console.log(`社区共享冰箱系统已启动: http://localhost:${PORT}`);
});
