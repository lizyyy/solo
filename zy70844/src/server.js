const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { Parser } = require('json2csv');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DB_PATH || path.join(dataDir, 'store.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params) {
  params = params || [];
  return new Promise((res, rej) => db.run(sql, params, function(e) {
    if (e) rej(e); else res({lastID: this.lastID, changes: this.changes});
  }));
}
function get(sql, params) {
  params = params || [];
  return new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r)));
}
function all(sql, params) {
  params = params || [];
  return new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r)));
}

function initTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, location_code TEXT UNIQUE NOT NULL, location_name TEXT NOT NULL, manager TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS sku_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, sku_code TEXT NOT NULL, sku_name TEXT NOT NULL, alias TEXT, category TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_no TEXT UNIQUE NOT NULL, location_code TEXT NOT NULL, batch_type TEXT NOT NULL, status TEXT DEFAULT "pending", handler TEXT, responsible_person TEXT, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS inventory_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, sku_code TEXT NOT NULL, sku_name TEXT, quantity INTEGER NOT NULL, unit_price REAL, expiry_date DATE, is_near_expiry INTEGER DEFAULT 0, inventory_person TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS sales_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, sku_code TEXT NOT NULL, sku_name TEXT, quantity INTEGER NOT NULL, amount REAL NOT NULL, sale_time DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS replenishment_records (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, sku_code TEXT NOT NULL, sku_name TEXT, expected_qty INTEGER NOT NULL, actual_qty INTEGER NOT NULL, difference_type TEXT, unit_price REAL, expiry_date DATE, is_near_expiry INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS processing_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, record_id INTEGER, record_type TEXT, action TEXT NOT NULL, reason TEXT, handler TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS sku_alias_detections (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, detected_alias TEXT NOT NULL, mapped_sku TEXT NOT NULL, record_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)', (err) => {
        if (err) reject(err); else resolve();
      });
    });
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/batches', async (req, res) => {
  const { location_code, batch_type, responsible_person, remark, handler } = req.body;
  if (!location_code || !batch_type) return res.status(400).json({ error: 'location_code and batch_type required' });
  const batch_no = 'B' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
  try {
    const result = await run('INSERT INTO batches (batch_no, location_code, batch_type, status, responsible_person, remark, handler) VALUES (?, ?, ?, ?, ?, ?, ?)', [batch_no, location_code, batch_type, 'pending', responsible_person || null, remark || null, handler || null]);
    res.json({ id: result.lastID, batch_no, location_code, batch_type, status: 'pending' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/batches', async (req, res) => {
  const { location_code, status, responsible_person, batch_type } = req.query;
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND location_code = ?'; params.push(location_code); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (responsible_person) { sql += ' AND responsible_person = ?'; params.push(responsible_person); }
  if (batch_type) { sql += ' AND batch_type = ?'; params.push(batch_type); }
  sql += ' ORDER BY created_at DESC';
  try { res.json(await all(sql, params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const inventory = await all('SELECT * FROM inventory_records WHERE batch_id = ?', [req.params.id]);
    const sales = await all('SELECT * FROM sales_records WHERE batch_id = ?', [req.params.id]);
    const replenishment = await all('SELECT * FROM replenishment_records WHERE batch_id = ?', [req.params.id]);
    const logs = await all('SELECT * FROM processing_logs WHERE batch_id = ? ORDER BY created_at DESC', [req.params.id]);
    const aliases = await all('SELECT * FROM sku_alias_detections WHERE batch_id = ?', [req.params.id]);
    res.json({ batch, inventory, sales, replenishment, logs, aliases });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/batches/:id/process', async (req, res) => {
  const { action, reason, handler } = req.body;
  if (!action || !handler) return res.status(400).json({ error: 'action and handler required' });
  let newStatus;
  switch (action) {
    case 'approve': newStatus = 'approved'; break;
    case 'reject': newStatus = 'rejected'; break;
    case 'return': newStatus = 'returned'; break;
    default: return res.status(400).json({ error: 'Invalid action: approve, reject, return' });
  }
  try {
    await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, req.params.id]);
    await run('INSERT INTO processing_logs (batch_id, action, reason, handler) VALUES (?, ?, ?, ?)', [req.params.id, action, reason || null, handler]);
    res.json({ batch_id: req.params.id, status: newStatus, action, handler });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/batches/:id/return', async (req, res) => {
  const { reason, handler } = req.body;
  if (!handler) return res.status(400).json({ error: 'handler required' });
  try {
    await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['returned', req.params.id]);
    await run('INSERT INTO processing_logs (batch_id, action, reason, handler) VALUES (?, ?, ?, ?)', [req.params.id, 'return', reason || null, handler]);
    res.json({ batch_id: req.params.id, status: 'returned', reason, handler });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function checkNearExpiry(expiryDate) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return diffDays <= 7 && diffDays > 0;
}

async function detectSKUAlias(skuName, skuCode) {
  if (!skuName) return null;
  const mappings = await all('SELECT * FROM sku_mappings');
  const normalizedName = skuName.toLowerCase().trim();
  for (const mapping of mappings) {
    if (mapping.alias) {
      const aliases = mapping.alias.split(/[,，、]/).map(a => a.toLowerCase().trim());
      if (aliases.includes(normalizedName) || aliases.some(a => normalizedName.includes(a) || a.includes(normalizedName))) {
        return { alias: skuName, sku_code: mapping.sku_code, sku_name: mapping.sku_name };
      }
    }
    if (mapping.sku_name.toLowerCase().trim() === normalizedName) {
      return null;
    }
  }
  return null;
}

app.post('/api/import/inventory/:batchId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please upload CSV file' });
  const batchId = req.params.batchId;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = [];
    const nearExpiryItems = [];
    const aliasDetections = [];
    const stream = Readable.from(req.file.buffer.toString());
    stream.pipe(csv()).on('data', (row) => {
      const skuCode = row.sku_code || row.skuCode || row['SKU编码'] || '';
      const skuName = row.sku_name || row.skuName || row['SKU名称'] || '';
      const quantity = parseInt(row.quantity || row['数量']) || 0;
      const unitPrice = parseFloat(row.unit_price || row['单价']) || 0;
      const expiryDate = row.expiry_date || row['过期日期'] || null;
      const inventoryPerson = row.inventory_person || row['盘点人'] || null;
      const isNearExpiry = checkNearExpiry(expiryDate);
      if (isNearExpiry) nearExpiryItems.push({ sku_code: skuCode, sku_name: skuName, expiry_date: expiryDate });
      records.push({ batch_id: batchId, sku_code: skuCode, sku_name: skuName, quantity, unit_price: unitPrice, expiry_date: expiryDate, is_near_expiry: isNearExpiry ? 1 : 0, inventory_person: inventoryPerson });
    }).on('end', async () => {
      for (const rec of records) {
        const aliasMatch = await detectSKUAlias(rec.sku_name, rec.sku_code);
        let finalSkuCode = rec.sku_code;
        let finalSkuName = rec.sku_name;
        if (aliasMatch && !rec.sku_code) {
          finalSkuCode = aliasMatch.sku_code;
          finalSkuName = aliasMatch.sku_name;
          aliasDetections.push({ batch_id: batchId, detected_alias: rec.sku_name, mapped_sku: aliasMatch.sku_code, record_type: 'inventory' });
        }
        await run('INSERT INTO inventory_records (batch_id, sku_code, sku_name, quantity, unit_price, expiry_date, is_near_expiry, inventory_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [rec.batch_id, finalSkuCode, finalSkuName, rec.quantity, rec.unit_price, rec.expiry_date, rec.is_near_expiry, rec.inventory_person]);
      }
      for (const alias of aliasDetections) {
        await run('INSERT INTO sku_alias_detections (batch_id, detected_alias, mapped_sku, record_type) VALUES (?, ?, ?, ?)', [alias.batch_id, alias.detected_alias, alias.mapped_sku, alias.record_type]);
      }
      res.json({ batch_id: batchId, imported: records.length, near_expiry_count: nearExpiryItems.length, near_expiry_items: nearExpiryItems.slice(0, 10), alias_detections: aliasDetections });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/import/sales/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const salesData = req.body;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = Array.isArray(salesData) ? salesData : (salesData.records || []);
    const aliasDetections = [];
    for (const record of records) {
      const skuName = record.sku_name || record.skuName || '';
      const skuCode = record.sku_code || record.skuCode || '';
      const aliasMatch = await detectSKUAlias(skuName, skuCode);
      let finalSkuCode = skuCode;
      let finalSkuName = skuName;
      if (aliasMatch && !skuCode) {
        finalSkuCode = aliasMatch.sku_code;
        finalSkuName = aliasMatch.sku_name;
        aliasDetections.push({ batch_id: batchId, detected_alias: skuName, mapped_sku: aliasMatch.sku_code, record_type: 'sales' });
      }
      await run('INSERT INTO sales_records (batch_id, sku_code, sku_name, quantity, amount, sale_time) VALUES (?, ?, ?, ?, ?, ?)', [batchId, finalSkuCode, finalSkuName, record.quantity || 0, record.amount || record.total || 0, record.sale_time || record.saleTime || null]);
    }
    for (const alias of aliasDetections) {
      await run('INSERT INTO sku_alias_detections (batch_id, detected_alias, mapped_sku, record_type) VALUES (?, ?, ?, ?)', [alias.batch_id, alias.detected_alias, alias.mapped_sku, alias.record_type]);
    }
    res.json({ batch_id: batchId, imported: records.length, alias_detections: aliasDetections });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/import/replenishment/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const data = req.body;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const records = Array.isArray(data) ? data : (data.records || []);
    const differences = [];
    const nearExpiryItems = [];
    const aliasDetections = [];
    for (const record of records) {
      const expectedQty = record.expected_qty || record.expectedQty || 0;
      const actualQty = record.actual_qty || record.actualQty || 0;
      const diff = actualQty - expectedQty;
      let differenceType = 'normal';
      if (diff > 0) { differenceType = 'over'; differences.push({ type: 'over', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty }); }
      else if (diff < 0) { differenceType = 'under'; differences.push({ type: 'under', sku: record.sku_code, diff, expected: expectedQty, actual: actualQty }); }
      const isNearExpiry = checkNearExpiry(record.expiry_date);
      if (isNearExpiry) nearExpiryItems.push({ sku_code: record.sku_code, expiry_date: record.expiry_date });
      const skuName = record.sku_name || '';
      const skuCode = record.sku_code || '';
      const aliasMatch = await detectSKUAlias(skuName, skuCode);
      let finalSkuCode = skuCode;
      let finalSkuName = skuName;
      if (aliasMatch && !skuCode) {
        finalSkuCode = aliasMatch.sku_code;
        finalSkuName = aliasMatch.sku_name;
        aliasDetections.push({ batch_id: batchId, detected_alias: skuName, mapped_sku: aliasMatch.sku_code, record_type: 'replenishment' });
      }
      await run('INSERT INTO replenishment_records (batch_id, sku_code, sku_name, expected_qty, actual_qty, difference_type, unit_price, expiry_date, is_near_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [batchId, finalSkuCode, finalSkuName, expectedQty, actualQty, differenceType, record.unit_price || 0, record.expiry_date || null, isNearExpiry ? 1 : 0]);
    }
    for (const alias of aliasDetections) {
      await run('INSERT INTO sku_alias_detections (batch_id, detected_alias, mapped_sku, record_type) VALUES (?, ?, ?, ?)', [alias.batch_id, alias.detected_alias, alias.mapped_sku, alias.record_type]);
    }
    res.json({ batch_id: batchId, imported: records.length, over_count: differences.filter(d => d.type === 'over').length, under_count: differences.filter(d => d.type === 'under').length, differences: differences.slice(0, 20), near_expiry_count: nearExpiryItems.length, near_expiry_items: nearExpiryItems, alias_detections: aliasDetections });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/query/inventory', async (req, res) => {
  const { location_code, sku_code, inventory_person, batch_id, near_expiry } = req.query;
  let sql = 'SELECT i.*, b.location_code, b.batch_no FROM inventory_records i JOIN batches b ON i.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND i.sku_code = ?'; params.push(sku_code); }
  if (inventory_person) { sql += ' AND i.inventory_person = ?'; params.push(inventory_person); }
  if (batch_id) { sql += ' AND i.batch_id = ?'; params.push(batch_id); }
  if (near_expiry === 'true') { sql += ' AND i.is_near_expiry = 1'; }
  sql += ' ORDER BY i.created_at DESC';
  try { const records = await all(sql, params); res.json({ count: records.length, records }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/query/sales', async (req, res) => {
  const { location_code, sku_code, batch_id, start_date, end_date } = req.query;
  let sql = 'SELECT s.*, b.location_code, b.batch_no FROM sales_records s JOIN batches b ON s.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND s.sku_code = ?'; params.push(sku_code); }
  if (batch_id) { sql += ' AND s.batch_id = ?'; params.push(batch_id); }
  if (start_date) { sql += ' AND s.sale_time >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND s.sale_time <= ?'; params.push(end_date); }
  sql += ' ORDER BY s.created_at DESC';
  try { const records = await all(sql, params); res.json({ count: records.length, records }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/query/replenishment', async (req, res) => {
  const { location_code, sku_code, batch_id, difference_type, near_expiry } = req.query;
  let sql = 'SELECT r.*, b.location_code, b.batch_no, (r.actual_qty - r.expected_qty) as difference FROM replenishment_records r JOIN batches b ON r.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND r.sku_code = ?'; params.push(sku_code); }
  if (batch_id) { sql += ' AND r.batch_id = ?'; params.push(batch_id); }
  if (difference_type) { sql += ' AND r.difference_type = ?'; params.push(difference_type); }
  if (near_expiry === 'true') { sql += ' AND r.is_near_expiry = 1'; }
  sql += ' ORDER BY r.created_at DESC';
  try { const records = await all(sql, params); res.json({ count: records.length, records }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/query/record/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  try {
    let record;
    if (type === 'inventory') {
      record = await get('SELECT i.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person FROM inventory_records i JOIN batches b ON i.batch_id = b.id WHERE i.id = ?', [id]);
    } else if (type === 'sales') {
      record = await get('SELECT s.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person FROM sales_records s JOIN batches b ON s.batch_id = b.id WHERE s.id = ?', [id]);
    } else if (type === 'replenishment') {
      record = await get('SELECT r.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person, (r.actual_qty - r.expected_qty) as difference FROM replenishment_records r JOIN batches b ON r.batch_id = b.id WHERE r.id = ?', [id]);
    } else {
      return res.status(400).json({ error: 'Invalid record type' });
    }
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const logs = await all('SELECT * FROM processing_logs WHERE batch_id = ? ORDER BY created_at DESC', [record.batch_id]);
    const batch = await get('SELECT * FROM batches WHERE id = ?', [record.batch_id]);
    res.json({ record, batch, processing_history: logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/query/sku-mappings', async (req, res) => {
  const { sku_code, alias } = req.query;
  let sql = 'SELECT * FROM sku_mappings WHERE 1=1';
  const params = [];
  if (sku_code) { sql += ' AND sku_code = ?'; params.push(sku_code); }
  if (alias) { sql += ' AND alias LIKE ?'; params.push('%' + alias + '%'); }
  try { res.json(await all(sql, params)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/query/sku-mappings', async (req, res) => {
  const { sku_code, sku_name, alias, category } = req.body;
  if (!sku_code || !sku_name) return res.status(400).json({ error: 'sku_code and sku_name required' });
  try {
    const result = await run('INSERT INTO sku_mappings (sku_code, sku_name, alias, category) VALUES (?, ?, ?, ?)', [sku_code, sku_name, alias || null, category || null]);
    res.json({ id: result.lastID, sku_code, sku_name, alias, category });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/query/locations', async (req, res) => {
  try { res.json(await all('SELECT * FROM locations ORDER BY location_code')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/query/locations', async (req, res) => {
  const { location_code, location_name, manager } = req.body;
  if (!location_code || !location_name) return res.status(400).json({ error: 'location_code and location_name required' });
  try {
    const result = await run('INSERT INTO locations (location_code, location_name, manager) VALUES (?, ?, ?)', [location_code, location_name, manager || null]);
    res.json({ id: result.lastID, location_code, location_name, manager });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/export/inventory', async (req, res) => {
  const { location_code, sku_code, inventory_person, batch_id, near_expiry } = req.query;
  let sql = 'SELECT i.id, b.batch_no, b.location_code, i.sku_code, i.sku_name, i.quantity, i.unit_price, i.expiry_date, i.is_near_expiry, i.inventory_person, i.created_at FROM inventory_records i JOIN batches b ON i.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND i.sku_code = ?'; params.push(sku_code); }
  if (inventory_person) { sql += ' AND i.inventory_person = ?'; params.push(inventory_person); }
  if (batch_id) { sql += ' AND i.batch_id = ?'; params.push(batch_id); }
  if (near_expiry === 'true') { sql += ' AND i.is_near_expiry = 1'; }
  sql += ' ORDER BY i.created_at DESC';
  try {
    const records = await all(sql, params);
    const fields = ['id', 'batch_no', 'location_code', 'sku_code', 'sku_name', 'quantity', 'unit_price', 'expiry_date', 'is_near_expiry', 'inventory_person', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_' + Date.now() + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/sales', async (req, res) => {
  const { location_code, sku_code, batch_id, start_date, end_date } = req.query;
  let sql = 'SELECT s.id, b.batch_no, b.location_code, s.sku_code, s.sku_name, s.quantity, s.amount, s.sale_time, s.created_at FROM sales_records s JOIN batches b ON s.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND s.sku_code = ?'; params.push(sku_code); }
  if (batch_id) { sql += ' AND s.batch_id = ?'; params.push(batch_id); }
  if (start_date) { sql += ' AND s.sale_time >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND s.sale_time <= ?'; params.push(end_date); }
  sql += ' ORDER BY s.created_at DESC';
  try {
    const records = await all(sql, params);
    const fields = ['id', 'batch_no', 'location_code', 'sku_code', 'sku_name', 'quantity', 'amount', 'sale_time', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_' + Date.now() + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/replenishment', async (req, res) => {
  const { location_code, sku_code, batch_id, difference_type, near_expiry } = req.query;
  let sql = 'SELECT r.id, b.batch_no, b.location_code, r.sku_code, r.sku_name, r.expected_qty, r.actual_qty, (r.actual_qty - r.expected_qty) as difference, r.difference_type, r.unit_price, r.expiry_date, r.is_near_expiry, r.created_at FROM replenishment_records r JOIN batches b ON r.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND r.sku_code = ?'; params.push(sku_code); }
  if (batch_id) { sql += ' AND r.batch_id = ?'; params.push(batch_id); }
  if (difference_type) { sql += ' AND r.difference_type = ?'; params.push(difference_type); }
  if (near_expiry === 'true') { sql += ' AND r.is_near_expiry = 1'; }
  sql += ' ORDER BY r.created_at DESC';
  try {
    const records = await all(sql, params);
    const fields = ['id', 'batch_no', 'location_code', 'sku_code', 'sku_name', 'expected_qty', 'actual_qty', 'difference', 'difference_type', 'unit_price', 'expiry_date', 'is_near_expiry', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="replenishment_' + Date.now() + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/batch/:batchId/report', async (req, res) => {
  const batchId = req.params.batchId;
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const inventory = await all('SELECT * FROM inventory_records WHERE batch_id = ?', [batchId]);
    const sales = await all('SELECT * FROM sales_records WHERE batch_id = ?', [batchId]);
    const replenishment = await all('SELECT * FROM replenishment_records WHERE batch_id = ?', [batchId]);
    const logs = await all('SELECT * FROM processing_logs WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    const aliases = await all('SELECT * FROM sku_alias_detections WHERE batch_id = ?', [batchId]);
    const totalInventoryQty = inventory.reduce((sum, r) => sum + r.quantity, 0);
    const totalSalesAmount = sales.reduce((sum, r) => sum + r.amount, 0);
    const overReplenish = replenishment.filter(r => r.difference_type === 'over').length;
    const underReplenish = replenishment.filter(r => r.difference_type === 'under').length;
    const nearExpiryCount = [...inventory, ...replenishment].filter(r => r.is_near_expiry).length;
    res.json({
      batch_info: batch,
      summary: {
        inventory_records: inventory.length, inventory_total_quantity: totalInventoryQty,
        sales_records: sales.length, sales_total_amount: totalSalesAmount,
        replenishment_records: replenishment.length,
        over_replenishment_count: overReplenish, under_replenishment_count: underReplenish,
        near_expiry_count: nearExpiryCount, alias_detections: aliases.length,
        processing_logs: logs.length
      },
      exceptions: {
        over_replenishment_items: replenishment.filter(r => r.difference_type === 'over'),
        under_replenishment_items: replenishment.filter(r => r.difference_type === 'under'),
        near_expiry_items: [...inventory, ...replenishment].filter(r => r.is_near_expiry),
        alias_detections: aliases
      },
      processing_history: logs,
      decision_trail: {
        final_status: batch.status, last_action: logs[0] || null,
        handler: batch.handler, responsible_person: batch.responsible_person
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

initTables().then(() => {
  app.listen(PORT, () => {
    console.log('便利店运营服务已启动: http://localhost:' + PORT);
    console.log('健康检查: http://localhost:' + PORT + '/api/health');
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

module.exports = app;
