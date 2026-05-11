const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDB, prepare, exec, saveDB } = require('./database');
const ExcelJS = require('exceljs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const handleError = (res, err) => {
  console.error(err);
  const msg = err.message || String(err);
  if (msg.includes('UNIQUE') || msg.includes('unique') || msg.includes('重复')) {
    return res.status(400).json({ error: '重复数据错误：该记录已存在', type: 'DUPLICATE' });
  }
  if (msg.includes('NOT NULL') || msg.includes('缺少') || msg.includes('required') || msg.includes('必填')) {
    return res.status(400).json({ error: msg.includes('缺少') ? msg : '缺少必填字段', type: 'MISSING_FIELD' });
  }
  res.status(500).json({ error: msg || '服务器错误' });
};

const validateRequired = (data, fields) => {
  const missing = fields.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
  if (missing.length > 0) {
    throw new Error(`缺少必填字段: ${missing.join(', ')}`);
  }
};

function getAll(query, ...params) {
  const stmt = prepare(query);
  return stmt.all(...params);
}

function getOne(query, ...params) {
  const stmt = prepare(query);
  return stmt.get(...params);
}

function runQuery(query, ...params) {
  const stmt = prepare(query);
  return stmt.run(...params);
}

app.get('/api/stores', (req, res) => {
  try {
    res.json(getAll('SELECT * FROM stores ORDER BY id'));
  } catch (err) { handleError(res, err); }
});

app.post('/api/stores', (req, res) => {
  try {
    validateRequired(req.body, ['name', 'address']);
    const existing = getOne('SELECT * FROM stores WHERE name = ?', req.body.name);
    if (existing) throw new Error('重复数据错误：该记录已存在');
    const result = runQuery('INSERT INTO stores (name, address, phone, created_at) VALUES (?, ?, ?, datetime("now"))', 
      req.body.name, req.body.address, req.body.phone || null);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.put('/api/stores/:id', (req, res) => {
  try {
    validateRequired(req.body, ['name', 'address']);
    const existing = getOne('SELECT * FROM stores WHERE name = ? AND id != ?', req.body.name, req.params.id);
    if (existing) throw new Error('重复数据错误：该记录已存在');
    runQuery('UPDATE stores SET name=?, address=?, phone=? WHERE id=?',
      req.body.name, req.body.address, req.body.phone || null, req.params.id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.delete('/api/stores/:id', (req, res) => {
  try {
    runQuery('DELETE FROM stores WHERE id=?', req.params.id);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

app.get('/api/devices', (req, res) => {
  try {
    const devices = getAll(`
      SELECT d.*, s.name as store_name 
      FROM devices d LEFT JOIN stores s ON d.store_id = s.id
      ORDER BY d.id
    `);
    res.json(devices);
  } catch (err) { handleError(res, err); }
});

app.get('/api/devices/:id', (req, res) => {
  try {
    const device = getOne(`
      SELECT d.*, s.name as store_name 
      FROM devices d LEFT JOIN stores s ON d.store_id = s.id
      WHERE d.id = ?
    `, req.params.id);
    res.json(device);
  } catch (err) { handleError(res, err); }
});

app.post('/api/devices', (req, res) => {
  try {
    validateRequired(req.body, ['store_id', 'device_code']);
    const existing = getOne('SELECT * FROM devices WHERE device_code = ?', req.body.device_code);
    if (existing) throw new Error('重复数据错误：该设备编号已存在');
    const result = runQuery('INSERT INTO devices (store_id, device_code, model, location, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      req.body.store_id, req.body.device_code, req.body.model || null, req.body.location || null, req.body.status || 'normal');
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.put('/api/devices/:id', (req, res) => {
  try {
    validateRequired(req.body, ['store_id', 'device_code']);
    const existing = getOne('SELECT * FROM devices WHERE device_code = ? AND id != ?', req.body.device_code, req.params.id);
    if (existing) throw new Error('重复数据错误：该设备编号已存在');
    runQuery('UPDATE devices SET store_id=?, device_code=?, model=?, location=?, status=? WHERE id=?',
      req.body.store_id, req.body.device_code, req.body.model || null, req.body.location || null, req.body.status || 'normal', req.params.id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.get('/api/consumables', (req, res) => {
  try {
    const items = getAll(`
      SELECT c.*, d.device_code, s.name as store_name,
        CASE WHEN c.current_level <= c.min_threshold THEN 1 ELSE 0 END as is_low
      FROM consumables c 
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN stores s ON d.store_id = s.id
      ORDER BY c.id
    `);
    res.json(items);
  } catch (err) { handleError(res, err); }
});

app.get('/api/consumables/low', (req, res) => {
  try {
    const items = getAll(`
      SELECT c.*, d.device_code, s.name as store_name
      FROM consumables c 
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN stores s ON d.store_id = s.id
      WHERE c.current_level <= c.min_threshold
      ORDER BY c.current_level ASC
    `);
    res.json(items);
  } catch (err) { handleError(res, err); }
});

app.post('/api/consumables', (req, res) => {
  try {
    validateRequired(req.body, ['device_id', 'type']);
    const result = runQuery('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      req.body.device_id, req.body.type, req.body.current_level || 100, req.body.min_threshold || 10);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.put('/api/consumables/:id', (req, res) => {
  try {
    runQuery('UPDATE consumables SET device_id=?, type=?, current_level=?, min_threshold=?, last_updated=datetime("now") WHERE id=?',
      req.body.device_id, req.body.type, req.body.current_level, req.body.min_threshold, req.params.id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.get('/api/faults', (req, res) => {
  try {
    const faults = getAll(`
      SELECT f.*, d.device_code, s.name as store_name
      FROM faults f 
      LEFT JOIN devices d ON f.device_id = d.id
      LEFT JOIN stores s ON d.store_id = s.id
      ORDER BY f.id DESC
    `);
    res.json(faults);
  } catch (err) { handleError(res, err); }
});

app.post('/api/faults', (req, res) => {
  try {
    validateRequired(req.body, ['device_id', 'fault_type']);
    const result = runQuery('INSERT INTO faults (device_id, fault_type, description, status, reported_at) VALUES (?, ?, ?, ?, datetime("now"))',
      req.body.device_id, req.body.fault_type, req.body.description || null, req.body.status || 'pending');
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.put('/api/faults/:id', (req, res) => {
  try {
    if (req.body.status === 'resolved') {
      runQuery('UPDATE faults SET device_id=?, fault_type=?, description=?, status=?, resolved_at=datetime("now") WHERE id=?',
        req.body.device_id, req.body.fault_type, req.body.description || null, req.body.status || 'pending', req.params.id);
    } else {
      runQuery('UPDATE faults SET device_id=?, fault_type=?, description=?, status=?, resolved_at=NULL WHERE id=?',
        req.body.device_id, req.body.fault_type, req.body.description || null, req.body.status || 'pending', req.params.id);
    }
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.get('/api/supply-orders', (req, res) => {
  try {
    const orders = getAll(`
      SELECT o.*, s.name as store_name, d.device_code
      FROM supply_orders o 
      LEFT JOIN stores s ON o.store_id = s.id
      LEFT JOIN devices d ON o.device_id = d.id
      ORDER BY o.id DESC
    `);
    res.json(orders);
  } catch (err) { handleError(res, err); }
});

app.post('/api/supply-orders', (req, res) => {
  try {
    validateRequired(req.body, ['store_id', 'type', 'item']);
    const result = runQuery('INSERT INTO supply_orders (store_id, device_id, type, item, quantity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
      req.body.store_id, req.body.device_id || null, req.body.type, req.body.item, req.body.quantity || 1, req.body.status || 'pending', req.body.notes || null);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.put('/api/supply-orders/:id', (req, res) => {
  try {
    if (req.body.status === 'completed') {
      runQuery('UPDATE supply_orders SET store_id=?, device_id=?, type=?, item=?, quantity=?, status=?, notes=?, completed_at=datetime("now") WHERE id=?',
        req.body.store_id, req.body.device_id || null, req.body.type, req.body.item, req.body.quantity || 1, req.body.status || 'pending', req.body.notes || null, req.params.id);
    } else {
      runQuery('UPDATE supply_orders SET store_id=?, device_id=?, type=?, item=?, quantity=?, status=?, notes=?, completed_at=NULL WHERE id=?',
        req.body.store_id, req.body.device_id || null, req.body.type, req.body.item, req.body.quantity || 1, req.body.status || 'pending', req.body.notes || null, req.params.id);
    }
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { handleError(res, err); }
});

app.post('/api/supply-orders/generate', (req, res) => {
  try {
    const lowItems = getAll(`
      SELECT c.id, c.device_id, d.store_id, c.type, s.name as store_name, d.device_code
      FROM consumables c 
      JOIN devices d ON c.device_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE c.current_level <= c.min_threshold
    `);

    const pendingOrders = getAll(`
      SELECT o.device_id, o.item FROM supply_orders o 
      WHERE o.status IN ('pending', 'in_progress')
    `);

    const existingMap = new Map();
    pendingOrders.forEach(o => {
      const key = `${o.device_id}-${o.item}`;
      existingMap.set(key, true);
    });

    const created = [];
    
    for (const item of lowItems) {
      const itemName = item.type.includes('墨粉') ? `${item.type}盒` : 'A4纸';
      const checkKey = `${item.device_id}-${itemName}`;
      
      if (!existingMap.has(checkKey)) {
        const qty = item.type === '纸张' ? 5 : 1;
        const result = runQuery(
          'INSERT INTO supply_orders (store_id, device_id, type, item, quantity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
          item.store_id, 
          item.device_id, 
          '耗材补给', 
          itemName,
          qty,
          'pending',
          `自动生成：设备${item.device_code}的${item.type}余量不足`
        );
        created.push({ id: result.lastInsertRowid, store_name: item.store_name, item: itemName, device_code: item.device_code });
        existingMap.set(checkKey, true);
      }
    }
    
    res.json({ count: created.length, orders: created });
  } catch (err) { handleError(res, err); }
});

app.get('/api/export', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '自助打印店补给系统';
    
    const storesSheet = workbook.addWorksheet('门店');
    storesSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '门店名称', key: 'name', width: 20 },
      { header: '地址', key: 'address', width: 40 },
      { header: '电话', key: 'phone', width: 18 },
    ];
    storesSheet.addRows(getAll('SELECT * FROM stores'));

    const devicesSheet = workbook.addWorksheet('设备');
    devicesSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '门店', key: 'store_name', width: 15 },
      { header: '设备编号', key: 'device_code', width: 18 },
      { header: '型号', key: 'model', width: 20 },
      { header: '位置', key: 'location', width: 20 },
      { header: '状态', key: 'status', width: 10 },
    ];
    const devices = getAll(`
      SELECT d.*, s.name as store_name FROM devices d LEFT JOIN stores s ON d.store_id = s.id
    `);
    devicesSheet.addRows(devices);

    const consSheet = workbook.addWorksheet('耗材余量');
    consSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '门店', key: 'store_name', width: 15 },
      { header: '设备', key: 'device_code', width: 18 },
      { header: '耗材类型', key: 'type', width: 15 },
      { header: '当前余量(%)', key: 'current_level', width: 12 },
      { header: '预警阈值', key: 'min_threshold', width: 10 },
      { header: '是否预警', key: 'is_low', width: 10 },
    ];
    const cons = getAll(`
      SELECT c.*, d.device_code, s.name as store_name,
        CASE WHEN c.current_level <= c.min_threshold THEN '是' ELSE '否' END as is_low
      FROM consumables c 
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN stores s ON d.store_id = s.id
    `);
    consSheet.addRows(cons);

    const faultsSheet = workbook.addWorksheet('故障记录');
    faultsSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '门店', key: 'store_name', width: 15 },
      { header: '设备', key: 'device_code', width: 18 },
      { header: '故障类型', key: 'fault_type', width: 15 },
      { header: '描述', key: 'description', width: 40 },
      { header: '状态', key: 'status', width: 12 },
      { header: '上报时间', key: 'reported_at', width: 20 },
      { header: '解决时间', key: 'resolved_at', width: 20 },
    ];
    const faults = getAll(`
      SELECT f.*, d.device_code, s.name as store_name
      FROM faults f 
      LEFT JOIN devices d ON f.device_id = d.id
      LEFT JOIN stores s ON d.store_id = s.id
    `);
    faultsSheet.addRows(faults);

    const ordersSheet = workbook.addWorksheet('补给单');
    ordersSheet.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: '门店', key: 'store_name', width: 15 },
      { header: '设备', key: 'device_code', width: 18 },
      { header: '类型', key: 'type', width: 12 },
      { header: '物品', key: 'item', width: 20 },
      { header: '数量', key: 'quantity', width: 8 },
      { header: '状态', key: 'status', width: 12 },
      { header: '备注', key: 'notes', width: 30 },
      { header: '创建时间', key: 'created_at', width: 20 },
      { header: '完成时间', key: 'completed_at', width: 20 },
    ];
    const orders = getAll(`
      SELECT o.*, s.name as store_name, d.device_code
      FROM supply_orders o 
      LEFT JOIN stores s ON o.store_id = s.id
      LEFT JOIN devices d ON o.device_id = d.id
    `);
    ordersSheet.addRows(orders);

    const alertsSheet = workbook.addWorksheet('预警汇总');
    alertsSheet.columns = [
      { header: '类型', key: 'type', width: 15 },
      { header: '门店', key: 'store_name', width: 15 },
      { header: '设备', key: 'device_code', width: 18 },
      { header: '详情', key: 'detail', width: 40 },
    ];
    const alerts = [];
    const lowCons = getAll(`
      SELECT c.*, d.device_code, s.name as store_name
      FROM consumables c 
      JOIN devices d ON c.device_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE c.current_level <= c.min_threshold
    `);
    lowCons.forEach(c => alerts.push({ type: '耗材预警', store_name: c.store_name, device_code: c.device_code, detail: `${c.type}余量${c.current_level}%` }));
    
    const pendingFaults = getAll(`
      SELECT f.*, d.device_code, s.name as store_name
      FROM faults f 
      JOIN devices d ON f.device_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE f.status IN ('pending', 'in_progress')
    `);
    pendingFaults.forEach(f => alerts.push({ type: '设备故障', store_name: f.store_name, device_code: f.device_code, detail: `${f.fault_type}: ${f.description || ''}` }));
    alertsSheet.addRows(alerts);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=print-shop-report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { handleError(res, err); }
});

app.post('/api/test/duplicate', (req, res) => {
  try {
    const store = getOne('SELECT * FROM stores LIMIT 1');
    const existing = getOne('SELECT * FROM stores WHERE name = ?', store.name);
    if (existing) throw new Error('重复数据错误：该记录已存在');
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

app.post('/api/test/missing-field', (req, res) => {
  try {
    validateRequired({ store_id: 1 }, ['store_id', 'device_code']);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

const PORT = 3000;

(async () => {
  await getDB();
  app.listen(PORT, () => {
    console.log(`自助打印店补给系统运行在 http://localhost:${PORT}`);
  });
})();
