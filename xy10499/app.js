const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, saveDatabase, getDb } = require('./database');

const app = express();
let PORT = 3001;

app.use(express.json());

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

function execute(db, sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

app.post('/api/activities', (req, res) => {
  const { name, store_name, start_time, end_time, attribution_window_hours } = req.body;
  
  if (!name || !store_name || !start_time || !end_time) {
    return res.status(400).json({ error: '缺少必要字段: name, store_name, start_time, end_time' });
  }

  const db = getDb();
  const window = attribution_window_hours || 24;
  const id = uuidv4();

  execute(
    db,
    `INSERT INTO activities (id, name, store_name, start_time, end_time, attribution_window_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, store_name, start_time, end_time, window]
  );

  res.status(201).json({
    id,
    name,
    store_name,
    start_time,
    end_time,
    attribution_window_hours: window
  });
});

app.post('/api/inventory', (req, res) => {
  const { activity_id, product_name, unit_cost, quantity } = req.body;

  if (!activity_id || !product_name || unit_cost === undefined || quantity === undefined) {
    return res.status(400).json({ error: '缺少必要字段: activity_id, product_name, unit_cost, quantity' });
  }

  const db = getDb();
  
  const activity = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activity_id]);
  
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }

  const id = uuidv4();

  execute(
    db,
    `INSERT INTO inventory (id, activity_id, product_name, unit_cost, total_quantity, remaining_quantity)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, activity_id, product_name, unit_cost, quantity, quantity]
  );

  res.status(201).json({
    id,
    activity_id,
    product_name,
    unit_cost,
    total_quantity: quantity,
    remaining_quantity: quantity
  });
});

app.post('/api/distributions', (req, res) => {
  const { activity_id, customer_id, product_name, quantity } = req.body;

  if (!activity_id || !customer_id || !product_name || !quantity) {
    return res.status(400).json({ error: '缺少必要字段: activity_id, customer_id, product_name, quantity' });
  }

  const db = getDb();
  
  const activity = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activity_id]);
  
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }

  const now = new Date();
  const startTime = new Date(activity.start_time);
  const endTime = new Date(activity.end_time);

  if (now < startTime || now > endTime) {
    return res.status(400).json({ error: '活动已结束或未开始，无法发放' });
  }

  const inventory = queryOne(
    db,
    'SELECT * FROM inventory WHERE activity_id = ? AND product_name = ?',
    [activity_id, product_name]
  );

  if (!inventory) {
    return res.status(404).json({ error: '该产品没有库存登记' });
  }

  if (inventory.remaining_quantity < quantity) {
    return res.status(400).json({ 
      error: '样品库存不足',
      remaining: inventory.remaining_quantity,
      requested: quantity
    });
  }

  const existingDistribution = queryOne(
    db,
    'SELECT * FROM distributions WHERE activity_id = ? AND customer_id = ? AND product_name = ?',
    [activity_id, customer_id, product_name]
  );

  if (existingDistribution) {
    return res.status(400).json({ error: '同一顾客已领取过该产品样品' });
  }

  const id = uuidv4();
  const distributedAt = new Date().toISOString();

  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      `INSERT INTO distributions (id, activity_id, customer_id, product_name, quantity, distributed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, activity_id, customer_id, product_name, quantity, distributedAt]
    );

    db.run(
      `UPDATE inventory SET remaining_quantity = remaining_quantity - ? 
       WHERE activity_id = ? AND product_name = ?`,
      [quantity, activity_id, product_name]
    );
    
    db.run('COMMIT');
    saveDatabase();
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  const updatedInventory = queryOne(
    db,
    'SELECT remaining_quantity FROM inventory WHERE activity_id = ? AND product_name = ?',
    [activity_id, product_name]
  );

  res.status(201).json({
    id,
    activity_id,
    customer_id,
    product_name,
    quantity,
    distributed_at: distributedAt,
    remaining_quantity: updatedInventory.remaining_quantity
  });
});

app.post('/api/purchases', (req, res) => {
  const { activity_id, customer_id, receipt_id, purchase_amount, purchased_at } = req.body;

  if (!activity_id || !customer_id || !receipt_id || purchase_amount === undefined) {
    return res.status(400).json({ error: '缺少必要字段: activity_id, customer_id, receipt_id, purchase_amount' });
  }

  const db = getDb();
  
  const activity = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activity_id]);
  
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }

  const distributions = queryAll(
    db,
    'SELECT * FROM distributions WHERE activity_id = ? AND customer_id = ? ORDER BY distributed_at DESC LIMIT 1',
    [activity_id, customer_id]
  );
  const distribution = distributions.length > 0 ? distributions[0] : null;

  if (!distribution) {
    return res.status(400).json({ error: '该顾客没有试吃记录，无法关联' });
  }

  const purchaseTime = purchased_at ? new Date(purchased_at) : new Date();
  const distributeTime = new Date(distribution.distributed_at);
  const hoursDiff = (purchaseTime - distributeTime) / (1000 * 60 * 60);

  if (hoursDiff > activity.attribution_window_hours) {
    return res.status(400).json({
      error: '购买时间超出归因窗口',
      window_hours: activity.attribution_window_hours,
      hours_since_distribution: Math.round(hoursDiff * 10) / 10
    });
  }

  const existingPurchase = queryOne(
    db,
    'SELECT * FROM purchases WHERE receipt_id = ?',
    [receipt_id]
  );

  if (existingPurchase) {
    return res.status(400).json({ error: '该小票已关联过试吃' });
  }

  const id = uuidv4();
  const purchasedAt = purchaseTime.toISOString();

  execute(
    db,
    `INSERT INTO purchases (id, activity_id, distribution_id, customer_id, receipt_id, purchase_amount, purchased_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, activity_id, distribution.id, customer_id, receipt_id, purchase_amount, purchasedAt]
  );

  res.status(201).json({
    id,
    activity_id,
    distribution_id: distribution.id,
    customer_id,
    receipt_id,
    purchase_amount,
    purchased_at: purchasedAt,
    attribution_window_hours: activity.attribution_window_hours,
    hours_since_distribution: Math.round(hoursDiff * 10) / 10
  });
});

app.post('/api/waste', (req, res) => {
  const { activity_id, product_name, quantity, reason } = req.body;

  if (!activity_id || !product_name || !quantity) {
    return res.status(400).json({ error: '缺少必要字段: activity_id, product_name, quantity' });
  }

  const db = getDb();
  
  const activity = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activity_id]);
  
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }

  const inventory = queryOne(
    db,
    'SELECT * FROM inventory WHERE activity_id = ? AND product_name = ?',
    [activity_id, product_name]
  );

  if (!inventory) {
    return res.status(404).json({ error: '该产品没有库存登记' });
  }

  if (inventory.remaining_quantity < quantity) {
    return res.status(400).json({
      error: '浪费数量超过剩余样品',
      remaining: inventory.remaining_quantity,
      requested: quantity
    });
  }

  const id = uuidv4();
  const wastedAt = new Date().toISOString();

  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      `INSERT INTO waste (id, activity_id, product_name, quantity, reason, wasted_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, activity_id, product_name, quantity, reason || null, wastedAt]
    );

    db.run(
      `UPDATE inventory SET remaining_quantity = remaining_quantity - ? 
       WHERE activity_id = ? AND product_name = ?`,
      [quantity, activity_id, product_name]
    );
    
    db.run('COMMIT');
    saveDatabase();
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  const updatedInventory = queryOne(
    db,
    'SELECT remaining_quantity FROM inventory WHERE activity_id = ? AND product_name = ?',
    [activity_id, product_name]
  );

  res.status(201).json({
    id,
    activity_id,
    product_name,
    quantity,
    reason,
    wasted_at: wastedAt,
    remaining_quantity: updatedInventory.remaining_quantity
  });
});

app.get('/api/activities/:id/review', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const activity = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [id]);
  
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }

  const allDists = queryAll(db, 'SELECT * FROM distributions WHERE activity_id = ?', [id]);

  const uniqueCustomers = new Set(allDists.map(d => d.customer_id));
  const tasterCount = uniqueCustomers.size;
  const totalSamplesDistributed = allDists.reduce((sum, d) => sum + d.quantity, 0);

  const allPurchases = queryAll(db, 'SELECT * FROM purchases WHERE activity_id = ?', [id]);

  const convertedCustomers = new Set(allPurchases.map(p => p.customer_id));
  const conversionCount = convertedCustomers.size;
  const totalRevenue = allPurchases.reduce((sum, p) => sum + p.purchase_amount, 0);

  const allWaste = queryAll(db, 'SELECT * FROM waste WHERE activity_id = ?', [id]);

  const totalWaste = allWaste.reduce((sum, w) => sum + w.quantity, 0);

  const allInventory = queryAll(db, 'SELECT * FROM inventory WHERE activity_id = ?', [id]);

  const sampleCostDetails = [];
  let totalSampleCost = 0;

  for (const inv of allInventory) {
    const distForProduct = allDists
      .filter(d => d.product_name === inv.product_name)
      .reduce((sum, d) => sum + d.quantity, 0);
    
    const wasteForProduct = allWaste
      .filter(w => w.product_name === inv.product_name)
      .reduce((sum, w) => sum + w.quantity, 0);

    const cost = (distForProduct + wasteForProduct) * inv.unit_cost;
    totalSampleCost += cost;

    sampleCostDetails.push({
      product_name: inv.product_name,
      unit_cost: inv.unit_cost,
      distributed: distForProduct,
      wasted: wasteForProduct,
      total_cost: cost,
      remaining: inv.remaining_quantity
    });
  }

  const conversionRate = tasterCount > 0 ? (conversionCount / tasterCount * 100).toFixed(1) : 0;

  const replenishmentSuggestions = [];
  for (const inv of allInventory) {
    const distForProduct = allDists
      .filter(d => d.product_name === inv.product_name)
      .reduce((sum, d) => sum + d.quantity, 0);

    if (inv.remaining_quantity === 0 && distForProduct > 0) {
      const suggestion = Math.ceil(distForProduct * 1.5);
      replenishmentSuggestions.push({
        product_name: inv.product_name,
        current_remaining: 0,
        last_distributed: distForProduct,
        suggested_replenish: suggestion,
        reason: `库存已耗尽，建议补货 ${suggestion} 份（上次发放量的 1.5 倍）`
      });
    } else if (inv.remaining_quantity < distForProduct * 0.3 && distForProduct > 0) {
      const suggestion = Math.ceil(distForProduct);
      replenishmentSuggestions.push({
        product_name: inv.product_name,
        current_remaining: inv.remaining_quantity,
        last_distributed: distForProduct,
        suggested_replenish: suggestion,
        reason: `库存不足 30%，建议补货 ${suggestion} 份`
      });
    }
  }

  res.json({
    activity: {
      id: activity.id,
      name: activity.name,
      store_name: activity.store_name,
      start_time: activity.start_time,
      end_time: activity.end_time,
      attribution_window_hours: activity.attribution_window_hours
    },
    summary: {
      taster_count: tasterCount,
      converted_count: conversionCount,
      conversion_rate_percent: parseFloat(conversionRate),
      total_samples_distributed: totalSamplesDistributed,
      total_revenue: totalRevenue,
      total_sample_cost: totalSampleCost,
      total_waste: totalWaste,
      roi: totalSampleCost > 0 ? ((totalRevenue - totalSampleCost) / totalSampleCost * 100).toFixed(1) : 0
    },
    sample_cost_details: sampleCostDetails,
    purchase_details: allPurchases.map(p => ({
      customer_id: p.customer_id,
      receipt_id: p.receipt_id,
      purchase_amount: p.purchase_amount,
      purchased_at: p.purchased_at
    })),
    waste_details: allWaste.map(w => ({
      product_name: w.product_name,
      quantity: w.quantity,
      reason: w.reason,
      wasted_at: w.wasted_at
    })),
    replenishment_suggestions: replenishmentSuggestions
  });
});

async function startServer() {
  await initDatabase();
  const server = app.listen(PORT, () => {
    console.log(`门店试吃转化 API 运行在 http://localhost:${PORT}`);
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`端口 ${PORT} 被占用，尝试 ${PORT + 1}...`);
      PORT++;
      startServer();
    }
  });
}

startServer();

module.exports = app;
