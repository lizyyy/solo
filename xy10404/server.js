const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDatabase() {
  db = await open({
    filename: path.join(__dirname, 'stock.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      warning_threshold REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (material_id) REFERENCES materials(id),
      UNIQUE(product_id, material_id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      sale_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_pending_review INTEGER DEFAULT 0,
      review_status TEXT DEFAULT 'approved',
      reviewer TEXT,
      reviewed_at DATETIME,
      is_daily_closed INTEGER DEFAULT 0,
      daily_close_id INTEGER,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (daily_close_id) REFERENCES daily_closes(id)
    );

    CREATE TABLE IF NOT EXISTS waste_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      waste_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      record_type TEXT NOT NULL,
      is_pending_review INTEGER DEFAULT 0,
      review_status TEXT DEFAULT 'approved',
      reviewer TEXT,
      reviewed_at DATETIME,
      is_daily_closed INTEGER DEFAULT 0,
      daily_close_id INTEGER,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (daily_close_id) REFERENCES daily_closes(id)
    );

    CREATE TABLE IF NOT EXISTS stock_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_type TEXT NOT NULL,
      daily_close_id INTEGER,
      material_id INTEGER NOT NULL,
      material_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock_before REAL NOT NULL,
      stock_after REAL NOT NULL,
      snapshot_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (daily_close_id) REFERENCES daily_closes(id)
    );

    CREATE TABLE IF NOT EXISTS daily_closes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      close_date TEXT NOT NULL UNIQUE,
      total_sales REAL NOT NULL DEFAULT 0,
      total_waste REAL NOT NULL DEFAULT 0,
      total_tasting REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sales_order_no ON sales(order_no);
    CREATE INDEX IF NOT EXISTS idx_sales_time ON sales(sale_time);
    CREATE INDEX IF NOT EXISTS idx_waste_time ON waste_records(waste_time);
    CREATE INDEX IF NOT EXISTS idx_daily_close_date ON daily_closes(close_date);
  `);
}

async function initSampleData() {
  const result = await db.get('SELECT COUNT(*) as count FROM materials');
  if (result.count > 0) return;

  const materials = [
    { name: '黑糖珍珠', unit: 'g', stock: 5000, threshold: 500 },
    { name: '奶盖', unit: 'ml', stock: 3000, threshold: 300 },
    { name: '红茶底', unit: 'ml', stock: 10000, threshold: 1000 },
    { name: '绿茶底', unit: 'ml', stock: 8000, threshold: 800 },
    { name: '鲜奶', unit: 'ml', stock: 6000, threshold: 600 },
    { name: '糖浆', unit: 'ml', stock: 4000, threshold: 400 }
  ];

  const materialIds = {};
  for (const m of materials) {
    const result = await db.run(
      'INSERT INTO materials (name, unit, current_stock, warning_threshold) VALUES (?, ?, ?, ?)',
      [m.name, m.unit, m.stock, m.threshold]
    );
    materialIds[m.name] = result.lastID;
  }

  const products = [
    { name: '黑糖珍珠奶茶', price: 18, recipe: [
      { material: '黑糖珍珠', qty: 80 },
      { material: '红茶底', qty: 200 },
      { material: '鲜奶', qty: 150 },
      { material: '糖浆', qty: 20 }
    ]},
    { name: '奶盖绿茶', price: 16, recipe: [
      { material: '奶盖', qty: 50 },
      { material: '绿茶底', qty: 350 },
      { material: '糖浆', qty: 15 }
    ]},
    { name: '经典奶茶', price: 14, recipe: [
      { material: '红茶底', qty: 200 },
      { material: '鲜奶', qty: 150 },
      { material: '糖浆', qty: 20 }
    ]},
    { name: '水果绿茶', price: 15, recipe: [
      { material: '绿茶底', qty: 350 },
      { material: '糖浆', qty: 25 }
    ]}
  ];

  for (const p of products) {
    const result = await db.run('INSERT INTO products (name, price) VALUES (?, ?)', [p.name, p.price]);
    const productId = result.lastID;
    for (const r of p.recipe) {
      await db.run('INSERT INTO product_recipes (product_id, material_id, quantity) VALUES (?, ?, ?)',
        [productId, materialIds[r.material], r.qty]);
    }
  }
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

async function isDailyClosed(date = getToday()) {
  const result = await db.get('SELECT id FROM daily_closes WHERE close_date = ?', [date]);
  return result ? result.id : null;
}

app.get('/api/materials', async (req, res) => {
  const materials = await db.all('SELECT * FROM materials ORDER BY name');
  res.json(materials);
});

app.get('/api/products', async (req, res) => {
  const products = await db.all(`
    SELECT p.*, 
           GROUP_CONCAT(m.name || ':' || pr.quantity || m.unit, ', ') as recipe_text
    FROM products p
    LEFT JOIN product_recipes pr ON p.id = pr.product_id
    LEFT JOIN materials m ON pr.material_id = m.id
    GROUP BY p.id
    ORDER BY p.name
  `);
  res.json(products);
});

app.get('/api/products/:id/recipe', async (req, res) => {
  const recipe = await db.all(`
    SELECT pr.*, m.name as material_name, m.unit, m.current_stock
    FROM product_recipes pr
    JOIN materials m ON pr.material_id = m.id
    WHERE pr.product_id = ?
  `, [req.params.id]);
  res.json(recipe);
});

app.post('/api/sales', async (req, res) => {
  const { order_no, product_id, quantity, is_pending_review } = req.body;

  if (!order_no || !product_id || !quantity) {
    return res.status(400).json({ error: '订单号、商品ID和数量不能为空' });
  }

  const dailyCloseId = await isDailyClosed();
  if (dailyCloseId) {
    return res.status(400).json({ error: '今日已日结，无法新增销售记录' });
  }

  const existingSale = await db.get('SELECT id FROM sales WHERE order_no = ?', [order_no]);
  if (existingSale) {
    return res.status(400).json({ error: '订单号已存在，重复销售单已拦截' });
  }

  const recipe = await db.all(`
    SELECT pr.*, m.name as material_name, m.current_stock, m.unit
    FROM product_recipes pr
    JOIN materials m ON pr.material_id = m.id
    WHERE pr.product_id = ?
  `, [product_id]);

  if (!is_pending_review) {
    for (const item of recipe) {
      const required = item.quantity * quantity;
      if (item.current_stock < required) {
        return res.status(400).json({ 
          error: `原料库存不足：${item.material_name} 剩余 ${item.current_stock}${item.unit}，需要 ${required}${item.unit}` 
        });
      }
    }

    for (const item of recipe) {
      await db.run('UPDATE materials SET current_stock = current_stock - ? WHERE id = ?', 
        [item.quantity * quantity, item.material_id]);
    }
  }

  const result = await db.run(`
    INSERT INTO sales (order_no, product_id, quantity, is_pending_review, review_status)
    VALUES (?, ?, ?, ?, ?)
  `, [
    order_no, 
    product_id, 
    quantity, 
    is_pending_review ? 1 : 0,
    is_pending_review ? 'pending' : 'approved'
  ]);

  res.json({ 
    id: result.lastID, 
    message: is_pending_review ? '销售记录已提交，等待审核' : '销售成功' 
  });
});

app.get('/api/sales', async (req, res) => {
  const { status, date } = req.query;
  let sql = `
    SELECT s.*, p.name as product_name, p.price
    FROM sales s
    JOIN products p ON s.product_id = p.id
  `;
  const params = [];

  if (status === 'pending') {
    sql += ' WHERE s.review_status = "pending"';
  } else if (status === 'approved') {
    sql += ' WHERE s.review_status = "approved"';
  }

  if (date) {
    sql += params.length ? ' AND' : ' WHERE';
    sql += ' DATE(s.sale_time) = ?';
    params.push(date);
  }

  sql += ' ORDER BY s.sale_time DESC';
  
  const sales = await db.all(sql, params);
  res.json(sales);
});

app.post('/api/waste', async (req, res) => {
  const { material_id, quantity, reason, record_type, is_pending_review } = req.body;

  if (!material_id || !quantity || !reason || !record_type) {
    return res.status(400).json({ error: '原料ID、数量、原因和记录类型不能为空' });
  }

  const dailyCloseId = await isDailyClosed();
  if (dailyCloseId) {
    return res.status(400).json({ error: '今日已日结，无法新增损耗记录' });
  }

  const material = await db.get('SELECT * FROM materials WHERE id = ?', [material_id]);
  if (!material) {
    return res.status(400).json({ error: '原料不存在' });
  }

  if (!is_pending_review && material.current_stock < quantity) {
    return res.status(400).json({ 
      error: `原料库存不足：${material.name} 剩余 ${material.current_stock}${material.unit}，无法报废 ${quantity}${material.unit}` 
    });
  }

  if (!is_pending_review) {
    await db.run('UPDATE materials SET current_stock = current_stock - ? WHERE id = ?', [quantity, material_id]);
  }

  const result = await db.run(`
    INSERT INTO waste_records (material_id, quantity, reason, record_type, is_pending_review, review_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    material_id,
    quantity,
    reason,
    record_type,
    is_pending_review ? 1 : 0,
    is_pending_review ? 'pending' : 'approved'
  ]);

  let warning = null;
  if (!is_pending_review) {
    const updatedMaterial = await db.get('SELECT * FROM materials WHERE id = ?', [material_id]);
    if (updatedMaterial.current_stock <= updatedMaterial.warning_threshold) {
      warning = `⚠️ 原料预警：${updatedMaterial.name} 剩余 ${updatedMaterial.current_stock}${updatedMaterial.unit}，已低于警戒值 ${updatedMaterial.warning_threshold}${updatedMaterial.unit}`;
    }
  }

  res.json({ 
    id: result.lastID, 
    message: is_pending_review ? '损耗记录已提交，等待审核' : (record_type === 'tasting' ? '试饮登记成功' : '报废登记成功'),
    warning
  });
});

app.get('/api/waste', async (req, res) => {
  const { status, date, record_type } = req.query;
  let sql = `
    SELECT w.*, m.name as material_name, m.unit
    FROM waste_records w
    JOIN materials m ON w.material_id = m.id
  `;
  const params = [];

  if (status === 'pending') {
    sql += ' WHERE w.review_status = "pending"';
  } else if (status === 'approved') {
    sql += ' WHERE w.review_status = "approved"';
  }

  if (record_type) {
    sql += params.length ? ' AND' : ' WHERE';
    sql += ' w.record_type = ?';
    params.push(record_type);
  }

  if (date) {
    sql += params.length ? ' AND' : ' WHERE';
    sql += ' DATE(w.waste_time) = ?';
    params.push(date);
  }

  sql += ' ORDER BY w.waste_time DESC';
  
  const waste = await db.all(sql, params);
  res.json(waste);
});

app.get('/api/pending-review', async (req, res) => {
  const pendingSales = await db.all(`
    SELECT s.*, p.name as product_name, 'sale' as type
    FROM sales s
    JOIN products p ON s.product_id = p.id
    WHERE s.review_status = 'pending'
    ORDER BY s.sale_time DESC
  `);

  const pendingWaste = await db.all(`
    SELECT w.*, m.name as material_name, m.unit, 'waste' as type
    FROM waste_records w
    JOIN materials m ON w.material_id = m.id
    WHERE w.review_status = 'pending'
    ORDER BY w.waste_time DESC
  `);

  res.json({ sales: pendingSales, waste: pendingWaste });
});

app.post('/api/review/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const { action, reviewer } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '操作类型必须是 approve 或 reject' });
  }

  const dailyCloseId = await isDailyClosed();

  if (type === 'sale') {
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale) {
      return res.status(400).json({ error: '销售记录不存在' });
    }
    if (sale.review_status !== 'pending') {
      return res.status(400).json({ error: '该记录不在待审核状态' });
    }
    if (dailyCloseId && sale.is_daily_closed) {
      return res.status(400).json({ error: '该记录所属日期已日结，无法审核' });
    }

    if (action === 'approve') {
      if (dailyCloseId) {
        return res.status(400).json({ error: '今日已日结，无法审核通过销售记录' });
      }

      const recipe = await db.all(`
        SELECT pr.*, m.name as material_name, m.current_stock, m.unit
        FROM product_recipes pr
        JOIN materials m ON pr.material_id = m.id
        WHERE pr.product_id = ?
      `, [sale.product_id]);

      for (const item of recipe) {
        const required = item.quantity * sale.quantity;
        if (item.current_stock < required) {
          return res.status(400).json({ 
            error: `原料库存不足：${item.material_name} 剩余 ${item.current_stock}${item.unit}，需要 ${required}${item.unit}` 
          });
        }
      }

      for (const item of recipe) {
        await db.run('UPDATE materials SET current_stock = current_stock - ? WHERE id = ?', 
          [item.quantity * sale.quantity, item.material_id]);
      }

      await db.run(`
        UPDATE sales 
        SET review_status = 'approved', is_pending_review = 0, reviewer = ?, reviewed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [reviewer || '管理员', id]);
    } else {
      await db.run(`
        UPDATE sales 
        SET review_status = 'rejected', is_pending_review = 0, reviewer = ?, reviewed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [reviewer || '管理员', id]);
    }

    res.json({ message: action === 'approve' ? '审核通过' : '审核拒绝' });
  } else if (type === 'waste') {
    const waste = await db.get('SELECT * FROM waste_records WHERE id = ?', [id]);
    if (!waste) {
      return res.status(400).json({ error: '损耗记录不存在' });
    }
    if (waste.review_status !== 'pending') {
      return res.status(400).json({ error: '该记录不在待审核状态' });
    }
    if (dailyCloseId && waste.is_daily_closed) {
      return res.status(400).json({ error: '该记录所属日期已日结，无法审核' });
    }

    if (action === 'approve') {
      if (dailyCloseId) {
        return res.status(400).json({ error: '今日已日结，无法审核通过损耗记录' });
      }

      const material = await db.get('SELECT * FROM materials WHERE id = ?', [waste.material_id]);
      if (material.current_stock < waste.quantity) {
        return res.status(400).json({ 
          error: `原料库存不足：${material.name} 剩余 ${material.current_stock}${material.unit}，无法扣减 ${waste.quantity}${material.unit}` 
        });
      }

      await db.run('UPDATE materials SET current_stock = current_stock - ? WHERE id = ?', [waste.quantity, waste.material_id]);

      await db.run(`
        UPDATE waste_records 
        SET review_status = 'approved', is_pending_review = 0, reviewer = ?, reviewed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [reviewer || '管理员', id]);
    } else {
      await db.run(`
        UPDATE waste_records 
        SET review_status = 'rejected', is_pending_review = 0, reviewer = ?, reviewed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [reviewer || '管理员', id]);
    }

    res.json({ message: action === 'approve' ? '审核通过' : '审核拒绝' });
  } else {
    return res.status(400).json({ error: '无效的记录类型' });
  }
});

app.post('/api/daily-close', async (req, res) => {
  const today = getToday();

  const existingClose = await db.get('SELECT id FROM daily_closes WHERE close_date = ?', [today]);
  if (existingClose) {
    return res.status(400).json({ error: '今日已日结' });
  }

  const pendingCount = await db.get(`
    SELECT 
      (SELECT COUNT(*) FROM sales WHERE review_status = 'pending' AND DATE(sale_time) = ?) +
      (SELECT COUNT(*) FROM waste_records WHERE review_status = 'pending' AND DATE(waste_time) = ?) as count
  `, [today, today]);

  if (pendingCount.count > 0) {
    return res.status(400).json({ error: `存在 ${pendingCount.count} 条待审核记录，请先审核完毕再日结` });
  }

  const materials = await db.all('SELECT * FROM materials');
  
  for (const m of materials) {
    await db.run(`
      INSERT INTO stock_snapshots (snapshot_type, material_id, material_name, unit, stock_before, stock_after)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['before_close', m.id, m.name, m.unit, m.current_stock, m.current_stock]);
  }

  const totalSales = await db.get(`
    SELECT COALESCE(SUM(p.price * s.quantity), 0) as total
    FROM sales s
    JOIN products p ON s.product_id = p.id
    WHERE DATE(s.sale_time) = ? AND s.review_status = 'approved'
  `, [today]);

  const totalWaste = await db.get(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM waste_records
    WHERE DATE(waste_time) = ? AND review_status = 'approved' AND record_type = 'waste'
  `, [today]);

  const totalTasting = await db.get(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM waste_records
    WHERE DATE(waste_time) = ? AND review_status = 'approved' AND record_type = 'tasting'
  `, [today]);

  const dailyCloseResult = await db.run(`
    INSERT INTO daily_closes (close_date, total_sales, total_waste, total_tasting)
    VALUES (?, ?, ?, ?)
  `, [today, totalSales.total, totalWaste.total, totalTasting.total]);
  const dailyCloseId = dailyCloseResult.lastID;

  await db.run(`
    UPDATE sales 
    SET is_daily_closed = 1, daily_close_id = ? 
    WHERE DATE(sale_time) = ?
  `, [dailyCloseId, today]);

  await db.run(`
    UPDATE waste_records 
    SET is_daily_closed = 1, daily_close_id = ? 
    WHERE DATE(waste_time) = ?
  `, [dailyCloseId, today]);

  await db.run(`
    UPDATE stock_snapshots 
    SET daily_close_id = ?, snapshot_type = 'after_close'
    WHERE daily_close_id IS NULL
  `, [dailyCloseId]);

  res.json({ 
    id: dailyCloseId, 
    message: '日结完成',
    data: {
      date: today,
      total_sales: totalSales.total,
      total_waste: totalWaste.total,
      total_tasting: totalTasting.total
    }
  });
});

app.get('/api/daily-closes', async (req, res) => {
  const closes = await db.all('SELECT * FROM daily_closes ORDER BY close_date DESC');
  res.json(closes);
});

app.get('/api/daily-close/:id/report', async (req, res) => {
  const dailyClose = await db.get('SELECT * FROM daily_closes WHERE id = ?', [req.params.id]);
  if (!dailyClose) {
    return res.status(404).json({ error: '日结记录不存在' });
  }

  const sales = await db.all(`
    SELECT s.*, p.name as product_name, p.price
    FROM sales s
    JOIN products p ON s.product_id = p.id
    WHERE s.daily_close_id = ?
    ORDER BY s.sale_time
  `, [req.params.id]);

  const waste = await db.all(`
    SELECT w.*, m.name as material_name, m.unit
    FROM waste_records w
    JOIN materials m ON w.material_id = m.id
    WHERE w.daily_close_id = ?
    ORDER BY w.waste_time
  `, [req.params.id]);

  const snapshots = await db.all(`
    SELECT * FROM stock_snapshots 
    WHERE daily_close_id = ?
    ORDER BY material_name
  `, [req.params.id]);

  res.json({
    daily_close: dailyClose,
    sales,
    waste,
    snapshots
  });
});

app.get('/api/dashboard', async (req, res) => {
  const today = getToday();

  const materials = await db.all(`
    SELECT *, 
      CASE WHEN current_stock <= warning_threshold THEN 1 ELSE 0 END as is_low
    FROM materials 
    ORDER BY is_low DESC, name
  `);

  const todaySales = await db.get(`
    SELECT COALESCE(SUM(p.price * s.quantity), 0) as total,
           COALESCE(COUNT(*), 0) as count
    FROM sales s
    JOIN products p ON s.product_id = p.id
    WHERE DATE(s.sale_time) = ? AND s.review_status = 'approved'
  `, [today]);

  const todayWaste = await db.all(`
    SELECT w.reason, COALESCE(SUM(w.quantity), 0) as total
    FROM waste_records w
    WHERE DATE(w.waste_time) = ? AND w.review_status = 'approved' AND w.record_type = 'waste'
    GROUP BY w.reason
  `, [today]);

  const todayTasting = await db.get(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM waste_records
    WHERE DATE(waste_time) = ? AND review_status = 'approved' AND record_type = 'tasting'
  `, [today]);

  const pendingReview = await db.get(`
    SELECT 
      (SELECT COUNT(*) FROM sales WHERE review_status = 'pending') as sales_count,
      (SELECT COUNT(*) FROM waste_records WHERE review_status = 'pending') as waste_count
  `);

  const isClosed = !!(await isDailyClosed());

  res.json({
    today,
    is_closed: isClosed,
    materials,
    today_sales: todaySales,
    today_waste: todayWaste,
    today_tasting: todayTasting,
    pending_review: pendingReview
  });
});

async function start() {
  await initDatabase();
  await initSampleData();
  app.listen(PORT, () => {
    console.log(`奶茶门店原料损耗台已启动: http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
});
