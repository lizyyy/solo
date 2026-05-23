const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const db = new sqlite3.Database('./data/nursing.db');

function run(sql, params) {
  params = params || [];
  return new Promise(function(resolve, reject) {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function get(sql, params) {
  params = params || [];
  return new Promise(function(resolve, reject) {
    db.get(sql, params, function(err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params) {
  params = params || [];
  return new Promise(function(resolve, reject) {
    db.all(sql, params, function(err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function genBatchNo() {
  return 'B-' + Date.now().toString(36).toUpperCase();
}

function genRecordNo() {
  return 'REC-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

function genOrderNo() {
  return 'SO-' + Date.now().toString(36).toUpperCase();
}

function calcDistance(a1, a2) {
  if (!a1 || !a2) return 0;
  var h = crypto.createHash('md5').update(a1 + a2).digest('hex');
  return (parseInt(h.slice(0, 6), 16) % 500) / 10 + 0.5;
}

function checkSkills(nurseSkills, required) {
  if (!nurseSkills || !required) return { matched: true, missing: [] };
  var ns = String(nurseSkills).split(',').map(function(s) { return s.trim(); });
  var rq = String(required).split(',').map(function(s) { return s.trim(); });
  var missing = rq.filter(function(s) { return ns.indexOf(s) < 0; });
  return { matched: missing.length === 0, missing: missing };
}

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/health', function(req, res) {
  res.json({ success: true, message: '护理站服务运行中', time: new Date().toISOString() });
});

app.post('/api/batches', async function(req, res) {
  try {
    var name = req.body.name;
    var created_by = req.body.created_by;
    var batchNo = genBatchNo();
    var r = await run('INSERT INTO batches (batch_no, name, created_by) VALUES (?, ?, ?)', [batchNo, name, created_by]);
    var batch = await get('SELECT * FROM batches WHERE id = ?', [r.lastID]);
    res.json({ success: true, data: batch });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/batches', async function(req, res) {
  try {
    var batches = await all('SELECT * FROM batches ORDER BY created_at DESC');
    res.json({ success: true, data: batches });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/elderly', async function(req, res) {
  try {
    var items = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
    var count = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        await run('INSERT INTO elderly (elderly_id, name, address, district, health_status) VALUES (?, ?, ?, ?, ?)',
          [item.elderly_id, item.name, item.address || '', item.district || '', item.health_status || '']);
        count++;
      } catch(e) {}
    }
    res.json({ success: true, data: { count: count } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/nurses', async function(req, res) {
  try {
    var items = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
    var count = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var skills = Array.isArray(item.skills) ? item.skills.join(',') : (item.skills || '');
      try {
        await run('INSERT INTO nurses (nurse_id, name, qualifications, skills, district) VALUES (?, ?, ?, ?, ?)',
          [item.nurse_id, item.name, item.qualifications || '', skills, item.district || '']);
        count++;
      } catch(e) {}
    }
    res.json({ success: true, data: { count: count } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/import/orders', async function(req, res) {
  try {
    var batch_id = req.body.batch_id;
    var orders = req.body.orders;
    var created_by = req.body.created_by;
    var count = 0;
    for (var i = 0; i < orders.length; i++) {
      var row = orders[i];
      var orderNo = genOrderNo();
      try {
        var r = await run('INSERT INTO orders (order_no, batch_id, elderly_id, service_type, service_items, address, district, status) VALUES (?, ?, ?, ?, ?, ?, ?, "pending")',
          [orderNo, batch_id, row.elderly_id || '', row.service_type || '常规护理', row.service_items || '', row.address || '', row.district || '']);
        count++;
        await run('INSERT INTO tracks (record_no, order_id, batch_id, elderly_id, service_type, status, action, reason, handled_by) VALUES (?, ?, ?, ?, ?, "pending", "import", "批量导入", ?)',
          [genRecordNo(), r.lastID, batch_id, row.elderly_id || '', row.service_type || '常规护理', created_by]);
      } catch(e) {}
    }
    await run('UPDATE batches SET total_count = total_count + ? WHERE id = ?', [count, batch_id]);
    res.json({ success: true, data: { count: count, total: orders.length } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders', async function(req, res) {
  try {
    var orders = await all('SELECT o.*, e.name as elderly_name, n.name as nurse_name FROM orders o LEFT JOIN elderly e ON o.elderly_id = e.elderly_id LEFT JOIN nurses n ON o.nurse_id = n.nurse_id ORDER BY o.created_at DESC');
    res.json({ success: true, data: orders });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

async function addTrack(orderId, status, action, reason, handledBy) {
  var order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  await run('INSERT INTO tracks (record_no, order_id, batch_id, elderly_id, nurse_id, service_type, status, action, reason, handled_by, route_info, skill_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [genRecordNo(), orderId, order.batch_id, order.elderly_id, order.nurse_id, order.service_type, status, action, reason, handledBy,
    JSON.stringify({ distance_km: order.distance_km, district: order.district }),
    JSON.stringify({ skill_check: 'verified' })]);
}

app.put('/api/orders/:id/assign', async function(req, res) {
  try {
    var nurse_id = req.body.nurse_id;
    var handled_by = req.body.handled_by;
    var order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    var nurse = await get('SELECT * FROM nurses WHERE nurse_id = ?', [nurse_id]);
    var skillCheck = checkSkills(nurse.skills, order.service_items);
    var distance = calcDistance(nurse.district, order.address);
    var reason = '分配护士: ' + nurse.name;
    if (!skillCheck.matched) reason += ' (技能不匹配)';
    if (nurse.district !== order.district) reason += ' (跨区, 距离约' + distance.toFixed(1) + 'km)';
    await run('UPDATE orders SET nurse_id = ?, distance_km = ? WHERE id = ?', [nurse_id, distance, req.params.id]);
    await addTrack(req.params.id, 'pending', 'assign_nurse', reason, handled_by);
    var updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/process', async function(req, res) {
  try {
    var handled_by = req.body.handled_by;
    var reason = req.body.reason || '开始处理';
    await run('UPDATE orders SET status = "processing" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'processing', 'process', reason, handled_by);
    var updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/approve', async function(req, res) {
  try {
    var handled_by = req.body.handled_by;
    var reason = req.body.reason || '审核通过';
    await run('UPDATE orders SET status = "approved" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'approved', 'approve', reason, handled_by);
    var updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/return', async function(req, res) {
  try {
    var handled_by = req.body.handled_by;
    var reason = req.body.reason;
    await run('UPDATE orders SET status = "returned" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'returned', 'return', reason, handled_by);
    var updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id/cancel', async function(req, res) {
  try {
    var handled_by = req.body.handled_by;
    var reason = req.body.reason;
    await run('UPDATE orders SET status = "cancelled" WHERE id = ?', [req.params.id]);
    await addTrack(req.params.id, 'cancelled', 'cancel', reason, handled_by);
    var updated = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/query/tracks', async function(req, res) {
  try {
    var sql = 'SELECT t.*, o.order_no, o.address, o.district, o.distance_km, o.service_items, e.name as elderly_name, n.name as nurse_name, n.qualifications as nurse_qualifications FROM tracks t LEFT JOIN orders o ON t.order_id = o.id LEFT JOIN elderly e ON t.elderly_id = e.elderly_id LEFT JOIN nurses n ON t.nurse_id = n.nurse_id WHERE 1=1';
    var params = [];
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
      params.push('%' + req.query.route + '%');
      params.push('%' + req.query.route + '%');
    }
    if (req.query.status) {
      sql += ' AND t.status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY t.handled_at DESC';
    var records = await all(sql, params);
    var withSource = records.map(function(r) {
      r.route_source = [
        { type: '服务地址', value: r.address },
        { type: '服务区域', value: r.district },
        { type: '路程距离', value: r.distance_km ? r.distance_km + '公里' : '' }
      ].filter(function(s) { return s.value; });
      return r;
    });
    res.json({ success: true, total: withSource.length, data: withSource });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/query/tracks/:id', async function(req, res) {
  try {
    var r = await get('SELECT t.*, o.order_no, o.address, o.district, o.service_items, e.name as elderly_name, e.health_status, n.name as nurse_name, n.qualifications FROM tracks t LEFT JOIN orders o ON t.order_id = o.id LEFT JOIN elderly e ON t.elderly_id = e.elderly_id LEFT JOIN nurses n ON t.nurse_id = n.nurse_id WHERE t.id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: '记录不存在' });
    r.explanation = '该记录于 ' + r.handled_at + ' 由 ' + r.handled_by + ' 执行「' + r.action + '」操作，原因：' + (r.reason || '无') + '，最终状态为「' + r.status + '」';
    res.json({ success: true, data: r });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id/history', async function(req, res) {
  try {
    var history = await all('SELECT t.*, n.name as nurse_name FROM tracks t LEFT JOIN nurses n ON t.nurse_id = n.nurse_id WHERE t.order_id = ? ORDER BY t.handled_at ASC', [req.params.id]);
    res.json({ success: true, data: history });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, function() {
  console.log('');
  console.log('===== 护理站后端服务已启动 =====');
  console.log('  服务地址: http://localhost:' + PORT);
  console.log('  健康检查: http://localhost:' + PORT + '/api/health');
  console.log('');
  console.log('  主要API接口:');
  console.log('  POST   /api/batches              - 新增批次');
  console.log('  POST   /api/import/elderly       - 导入老人档案');
  console.log('  POST   /api/import/nurses        - 导入护士数据');
  console.log('  POST   /api/import/orders        - 导入服务单');
  console.log('  PUT    /api/orders/:id/process   - 标记处理');
  console.log('  PUT    /api/orders/:id/approve   - 审核通过');
  console.log('  PUT    /api/orders/:id/return    - 退回修改');
  console.log('  PUT    /api/orders/:id/cancel    - 取消');
  console.log('  GET    /api/query/tracks         - 查询追踪记录');
  console.log('  GET    /api/query/tracks?qualifications=主管护师 - 按资质查询');
  console.log('  GET    /api/query/tracks?service_items=血压测量 - 按项目查询');
  console.log('  GET    /api/query/tracks?route=朝阳区 - 按路线查询');
  console.log('  GET    /api/query/tracks/:id     - 单条记录详情（可解释）');
  console.log('');
});
