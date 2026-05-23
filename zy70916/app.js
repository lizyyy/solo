const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, 'data/nursing.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((res, rej) => db.run(sql, params, function(err) {
    if (err) rej(err); else res({ changes: this.changes, lastID: this.lastID });
  }));
}

function get(sql, params = []) {
  return new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r)));
}

function all(sql, params = []) {
  return new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r)));
}

async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    total_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  await run(`CREATE TABLE IF NOT EXISTS elderly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elderly_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    district TEXT,
    health_status TEXT
  )`);
  
  await run(`CREATE TABLE IF NOT EXISTS nurses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nurse_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    qualifications TEXT,
    skills TEXT,
    district TEXT
  )`);
  
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    batch_id INTEGER,
    elderly_id TEXT,
    nurse_id TEXT,
    service_type TEXT,
    service_items TEXT,
    address TEXT,
    district TEXT,
    status TEXT DEFAULT 'pending',
    distance_km REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  await run(`CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_no TEXT UNIQUE NOT NULL,
    order_id INTEGER NOT NULL,
    batch_id INTEGER,
    elderly_id TEXT,
    nurse_id TEXT,
    service_type TEXT,
    status TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    handled_by TEXT NOT NULL,
    handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    route_info TEXT,
    skill_info TEXT
  )`);
}

function genBatchNo() {
  const d = new Date();
  return 'B-' + d.toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
}

function genRecordNo() {
  return 'REC-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function genOrderNo() {
  const d = new Date();
  return 'SO-' + d.toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Math.floor(Math.random()*10000)).padStart(4,'0');
}

function calcDistance(a1, a2) {
  if (!a1 || !a2) return 0;
  const h = crypto.createHash('md5').update(a1+a2).digest('hex');
  return (parseInt(h.slice(0,6), 16) % 500) / 10 + 0.5;
}

function checkSkills(nurseSkills, required) {
  if (!nurseSkills || !required) return { matched: true, missing: [] };
  const ns = (''+nurseSkills).split(',').map(s => s.trim());
  const rq = (''+required).split(',').map(s => s.trim());
  const missing = rq.filter(s => !ns.includes(s));
  return { matched: missing.length === 0, missing };
}

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, msg: '护理站服务运行中', time: new Date().toISOString() }));

app.post('/api/batches', async (req, res) => {
  try {
    const { name, created_by } = req.body;
    if (!name || !created_by) return res.status(400).json({ error: '缺少参数' });
    const batchNo = genBatchNo();
    const r = await run('INSERT INTO batches (batch_no, name, created_by) VALUES (?, ?, ?)', [batchNo, name, created_by]);
    const batch = await get('SELECT * FROM batches WHERE id = ?', [r.lastID]);
    res.json({ success: true, data: batch });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/batches', async (req, res) => {
  try {
    const batches = await all('SELECT * FROM batches ORDER BY created_at DESC');
    res.json({ success: true, data: batches });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/elderly', async (req, res) => {
  try {
    const { data, created_by } = req.body;
    const items = Array.isArray(data) ? data : [data];
    let count = 0;
    for (const item of items) {
      try {
        await run('INSERT INTO elderly (elderly_id, name, address, district, health_status) VALUES (?, ?, ?, ?, ?)',
          [item.elderly_id, item.name, item.address||'', item.district||'', item.health_status||'']);
        count++;
      } catch(e) {}
    }
    res.json({ success: true, data: { count } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/nurses', async (req, res) => {
  try {
    const { data, created_by } = req.body;
    const items = Array.isArray(data) ? data : [data];
    let count = 0;
    for (const item of items) {
      const skills = Array.isArray(item.skills) ? item.skills.join(',') : (item.skills || '');
      try {
        await run('INSERT INTO nurses (nurse_id, name, qualifications, skills, district) VALUES (?, ?, ?, ?, ?)',
          [item.nurse_id, item.name, item.qualifications||'', skills, item.district||'']);
        count++;
      } catch(e) {}
    }
    res.json({ success: true, data: { count } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/orders', async (req, res) => {
  try {
    const { batch_id, orders, created_by } = req.body;
    let count = 0;
    for (const row of orders) {
      const orderNo = row.order_no || genOrderNo();
      try {
        const r = await run('INSERT INTO orders (order_no, batch_id, elderly_id, service_type, service_items, address, district, status) VALUES (?, ?, ?, ?, ?, ?, ?, "pending")',
          [orderNo, batch_id, row.elderly_id||'', row.service_type||'常规护理', row.service_items||'', row.address||'', row.district||'']);
        count++;
        await run('INSERT INTO tracks (record_no, order_id, batch_id, elderly_id, service_type, status, action, reason, handled_by) VALUES (?, ?, ?, ?, ?, "pending", "import", "批量导入", ?)',
          [genRecordNo(), r.lastID, batch_id, row.elderly_id||'', row.service_type||'常规护理', created_by]);
      } catch(e) {}
    }
    await run('UPDATE batches SET total_count = total_count + ? WHERE id = ?', [count, batch_id]);
    res.json({ success: true, data: { count, total: orders.length } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await all(`SELECT o.*, e.name as elderly_name, n.name as nurse_name 
      FROM orders o LEFT JOIN elderly e ON o.elderly_id = e.elderly_id 
      LEFT JOIN nurses n ON o.nurse_id = n.nurse_id ORDER BY o.created_at DESC`);
    res.json({ success: true, data: orders });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

async function addTrack(orderId, status, action, reason, handledBy) {
  const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  await run(`INSERT INTO tracks (record_no, order_id, batch_id, elderly_id, nurse_id, service_type, status, action, reason, handled_by, route_info, skill_info) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      genRecordNo(), orderId, order.batch_id, order.elderly_id, order.nurse_id, order.service_type, status, action, reason, handledBy,
      JSON.stringify({ distance_km: order.distance_km, district: order.district }),
      JSON.stringify({ skill_check: 'pending' })
    ]);
}

app.put('/api/orders/:id/assign', async (req, res) => {
  try {
    const { nurse_id, handled_by } = req.body;
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const nurse = await get('SELECT * FROM nurses WHERE nurse_id = ?', [nurse_id]);
    const skillCheck = checkSkills(nurse.skills, order.service_items);
    const distance = calcDistance(nurse.district, order.address);
    const crossDistrict = nurse.district !== order.district;
    let reason = '分配护士: ' + nurse.name;
    if (!skillCheck.matched) reason += ' (技能不匹配: 缺少' + skillCheck.missing.join(',') + ')';
    if (crossDistrict) reason += ' (跨区, 距离约' + distance.toFixed(1) + '公里)';
    await run('UPDATE orders SET nurse_id = ?, distance_km = ? WHERE id = ?', [nurse_id, distance, req.params.id]);
    await addTrack(req.params.id, 'pending', 'assign_nurse', reason, handled_by);
    const updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/process', async (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    await run('UPDATE orders SET status = "processing" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'processing', 'process', reason || '开始处理', handled_by);
    const updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/approve', async (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    await run('UPDATE orders SET status = "approved" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'approved', 'approve', reason || '审核通过', handled_by);
    const updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/return', async (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!reason) return res.status(400).json({ error: '退回原因不能为空' });
    await run('UPDATE orders SET status = "returned" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'returned', 'return', reason, handled_by);
    const updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/cancel', async (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!reason) return res.status(400).json({ error: '取消原因不能为空' });
    await run('UPDATE orders SET status = "cancelled" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'cancelled', 'cancel', reason, handled_by);
    const updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/query/tracks', async (req, res) => {
  try {
    let sql = `SELECT t.*, o.order_no, o.address, o.district, o.distance_km, o.service_items, 
      e.name as elderly_name, n.name as nurse_name, n.qualifications as nurse_qualifications
      FROM tracks t LEFT JOIN orders o ON t.order_id = o.id 
      LEFT JOIN elderly e ON t.elderly_id = e.elderly_id 
      LEFT JOIN nurses n ON t.nurse_id = n.nurse_id WHERE 1=1`;
    const params = [];
    if (req.query.qualifications) {
      sql += ' AND n.qualifications LIKE ?';
      params.push('%' + req.query.qualifications + '%');
    }
    if (req.query.service_items) {
      sql += ' AND o.service_items LIKE ?';
      params.push('%' + req.query.service_items + '%');
    }
    if (req.query.route) {
      sql += ' AND (o.address LIKE ? OR o.district LIKE ?)';
      params.push('%' + req.query.route + '%', '%' + req.query.route + '%');
    }
    if (req.query.status) {
      sql += ' AND t.status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY t.handled_at DESC';
    const records = await all(sql, params);
    const withSource = records.map(r => ({
      ...r,
      route_source: [
        { type: '服务地址', value: r.address },
        { type: '服务区域', value: r.district },
        { type: '路程距离', value: r.distance_km ? r.distance_km + '公里' : '' }
      ].filter(s => s.value)
    }));
    res.json({ success: true, total: withSource.length, data: withSource });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/query/tracks/:id', async (req, res) => {
  try {
    const r = await get(`SELECT t.*, o.order_no, o.address, o.district, o.service_items,
      e.name as elderly_name, e.health_status, n.name as nurse_name, n.qualifications, n.skills
      FROM tracks t LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN elderly e ON t.elderly_id = e.elderly_id
      LEFT JOIN nurses n ON t.nurse_id = n.nurse_id WHERE t.id = ?`, [req.params.id]);
    if (!r) return res.status(404).json({ error: '记录不存在' });
    res.json({
      success: true,
      data: {
        ...r,
        explanation: `该记录于 ${r.handled_at} 由 ${r.handled_by} 执行 ${r.action} 操作，原因：${r.reason || '无'}，最终状态为 ${r.status}`,
        route_trace: [
          { source: '服务单地址', value: r.address },
          { source: '服务区域', value: r.district },
          { source: '操作来源', value: r.action }
        ]
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id/history', async (req, res) => {
  try {
    const history = await all('SELECT t.*, n.name as nurse_name FROM tracks t LEFT JOIN nurses n ON t.nurse_id = n.nurse_id WHERE t.order_id = ? ORDER BY t.handled_at ASC', [req.params.id]);
    res.json({ success: true, data: history });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  护理站后端服务已启动');
    console.log('  http://localhost:' + PORT);
    console.log('========================================');
    console.log('  主要功能:');
    console.log('  - 新增批次 POST /api/batches');
    console.log('  - 导入数据 POST /api/import/...');
    console.log('  - 标记处理 PUT /api/orders/:id/process');
    console.log('  - 退回修改 PUT /api/orders/:id/return');
    console.log('  - 取消 PUT /api/orders/:id/cancel');
    console.log('  - 取消补位 PUT /api/orders/:id/assign (重新分配)');
    console.log('  - 历史查询 GET /api/query/tracks');
    console.log('  - 路线溯源 GET /api/query/tracks?route=...');
    console.log('  - 资质查询 GET /api/query/tracks?qualifications=...');
    console.log('  - 项目查询 GET /api/query/tracks?service_items=...');
    console.log('========================================');
  });
});
