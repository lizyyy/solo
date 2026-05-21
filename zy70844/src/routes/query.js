const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database');

router.get('/inventory', async (req, res) => {
  const { location_code, sku_code, inventory_person, batch_id, near_expiry } = req.query;
  let sql = 'SELECT i.*, b.location_code, b.batch_no FROM inventory_records i JOIN batches b ON i.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND i.sku_code = ?'; params.push(sku_code); }
  if (inventory_person) { sql += ' AND i.inventory_person = ?'; params.push(inventory_person); }
  if (batch_id) { sql += ' AND i.batch_id = ?'; params.push(batch_id); }
  if (near_expiry === 'true') { sql += ' AND i.is_near_expiry = 1'; }
  sql += ' ORDER BY i.created_at DESC';
  try {
    const records = await all(sql, params);
    res.json({ count: records.length, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sales', async (req, res) => {
  const { location_code, sku_code, batch_id, start_date, end_date } = req.query;
  let sql = 'SELECT s.*, b.location_code, b.batch_no FROM sales_records s JOIN batches b ON s.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND s.sku_code = ?'; params.push(sku_code); }
  if (batch_id) { sql += ' AND s.batch_id = ?'; params.push(batch_id); }
  if (start_date) { sql += ' AND s.sale_time >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND s.sale_time <= ?'; params.push(end_date); }
  sql += ' ORDER BY s.created_at DESC';
  try {
    const records = await all(sql, params);
    res.json({ count: records.length, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/replenishment', async (req, res) => {
  const { location_code, sku_code, batch_id, difference_type, near_expiry } = req.query;
  let sql = 'SELECT r.*, b.location_code, b.batch_no, (r.actual_qty - r.expected_qty) as difference FROM replenishment_records r JOIN batches b ON r.batch_id = b.id WHERE 1=1';
  const params = [];
  if (location_code) { sql += ' AND b.location_code = ?'; params.push(location_code); }
  if (sku_code) { sql += ' AND r.sku_code = ?'; params.push(sku_code); }
  if (batch_id) { sql += ' AND r.batch_id = ?'; params.push(batch_id); }
  if (difference_type) { sql += ' AND r.difference_type = ?'; params.push(difference_type); }
  if (near_expiry === 'true') { sql += ' AND r.is_near_expiry = 1'; }
  sql += ' ORDER BY r.created_at DESC';
  try {
    const records = await all(sql, params);
    res.json({ count: records.length, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/record/:type/:id', async (req, res) => {
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

router.get('/sku-mappings', async (req, res) => {
  const { sku_code, alias } = req.query;
  let sql = 'SELECT * FROM sku_mappings WHERE 1=1';
  const params = [];
  if (sku_code) { sql += ' AND sku_code = ?'; params.push(sku_code); }
  if (alias) { sql += ' AND alias LIKE ?'; params.push('%' + alias + '%'); }
  try {
    const mappings = await all(sql, params);
    res.json(mappings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sku-mappings', async (req, res) => {
  const { sku_code, sku_name, alias, category } = req.body;
  if (!sku_code || !sku_name) return res.status(400).json({ error: 'sku_code and sku_name required' });
  try {
    const result = await run('INSERT INTO sku_mappings (sku_code, sku_name, alias, category) VALUES (?, ?, ?, ?)', [sku_code, sku_name, alias || null, category || null]);
    res.json({ id: result.lastID, sku_code, sku_name, alias, category });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/locations', async (req, res) => {
  try {
    const locations = await all('SELECT * FROM locations ORDER BY location_code');
    res.json(locations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/locations', async (req, res) => {
  const { location_code, location_name, manager } = req.body;
  if (!location_code || !location_name) return res.status(400).json({ error: 'location_code and location_name required' });
  try {
    const result = await run('INSERT INTO locations (location_code, location_name, manager) VALUES (?, ?, ?)', [location_code, location_name, manager || null]);
    res.json({ id: result.lastID, location_code, location_name, manager });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
  }
  if (difference_type) {
    sql += ' AND r.difference_type = ?';
    params.push(difference_type);
  }
  if (near_expiry === 'true') {
    sql += ' AND r.is_near_expiry = 1';
  }
  
  sql += ' ORDER BY r.created_at DESC';
  
  try {
    const records = await all(sql, params);
    res.json({ count: records.length, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/record/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  
  try {
    let record;
    
    switch (type) {
      case 'inventory':
        record = await get(`
          SELECT i.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person
          FROM inventory_records i
          JOIN batches b ON i.batch_id = b.id
          WHERE i.id = ?
        `, [id]);
        break;
      case 'sales':
        record = await get(`
          SELECT s.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person
          FROM sales_records s
          JOIN batches b ON s.batch_id = b.id
          WHERE s.id = ?
        `, [id]);
        break;
      case 'replenishment':
        record = await get(`
          SELECT r.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person,
                 (r.actual_qty - r.expected_qty) as difference
          FROM replenishment_records r
          JOIN batches b ON r.batch_id = b.id
          WHERE r.id = ?
        `, [id]);
        break;
      default:
        return res.status(400).json({ error: '无效的记录类型' });
    }
    
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const logs = await all(`
      SELECT * FROM processing_logs 
      WHERE batch_id = ? 
      ORDER BY created_at DESC
    `, [record.batch_id]);
    
    const batch = await get('SELECT * FROM batches WHERE id = ?', [record.batch_id]);
    
    res.json({
      record,
      batch,
      processing_history: logs,
      trace_link: `/api/query/record/${type}/${id}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sku-mappings', async (req, res) => {
  const { sku_code, alias } = req.query;
  
  let sql = 'SELECT * FROM sku_mappings WHERE 1=1';
  const params = [];
  
  if (sku_code) {
    sql += ' AND sku_code = ?';
    params.push(sku_code);
  }
  if (alias) {
    sql += ' AND alias LIKE ?';
    params.push(`%${alias}%`);
  }
  
  try {
    const mappings = await all(sql, params);
    res.json(mappings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sku-mappings', async (req, res) => {
  const { sku_code, sku_name, alias, category } = req.body;
  
  if (!sku_code || !sku_name) {
    return res.status(400).json({ error: 'sku_code 和 sku_name 为必填项' });
  }
  
  try {
    const result = await run(
      `INSERT INTO sku_mappings (sku_code, sku_name, alias, category) VALUES (?, ?, ?, ?)`,
      [sku_code, sku_name, alias || null, category || null]
    );
    res.json({ id: result.lastID, sku_code, sku_name, alias, category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/locations', async (req, res) => {
  try {
    const locations = await all('SELECT * FROM locations ORDER BY location_code');
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/locations', async (req, res) => {
  const { location_code, location_name, manager } = req.body;
  
  if (!location_code || !location_name) {
    return res.status(400).json({ error: 'location_code 和 location_name 为必填项' });
  }
  
  try {
    const result = await run(
      `INSERT INTO locations (location_code, location_name, manager) VALUES (?, ?, ?)`,
      [location_code, location_name, manager || null]
    );
    res.json({ id: result.lastID, location_code, location_name, manager });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
  sql += ' ORDER BY r.created_at DESC';
  
  const records = db.prepare(sql).all(...params);
  res.json({ count: records.length, records });
});

router.get('/record/:type/:id', (req, res) => {
  const { type, id } = req.params;
  
  let record;
  let table;
  
  switch (type) {
    case 'inventory':
      table = 'inventory_records';
      record = db.prepare(`
        SELECT i.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person
        FROM inventory_records i
        JOIN batches b ON i.batch_id = b.id
        WHERE i.id = ?
      `).get(id);
      break;
    case 'sales':
      table = 'sales_records';
      record = db.prepare(`
        SELECT s.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person
        FROM sales_records s
        JOIN batches b ON s.batch_id = b.id
        WHERE s.id = ?
      `).get(id);
      break;
    case 'replenishment':
      table = 'replenishment_records';
      record = db.prepare(`
        SELECT r.*, b.location_code, b.batch_no, b.status as batch_status, b.responsible_person
        FROM replenishment_records r
        JOIN batches b ON r.batch_id = b.id
        WHERE r.id = ?
      `).get(id);
      break;
    default:
      return res.status(400).json({ error: '无效的记录类型' });
  }
  
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const logs = db.prepare(`
    SELECT * FROM processing_logs 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `).all(record.batch_id);
  
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(record.batch_id);
  
  res.json({
    record,
    batch,
    processing_history: logs,
    trace_link: `/api/record/${type}/${id}`
  });
});

router.get('/sku-mappings', (req, res) => {
  const { sku_code, alias } = req.query;
  
  let sql = 'SELECT * FROM sku_mappings WHERE 1=1';
  const params = [];
  
  if (sku_code) {
    sql += ' AND sku_code = ?';
    params.push(sku_code);
  }
  if (alias) {
    sql += ' AND alias LIKE ?';
    params.push(`%${alias}%`);
  }
  
  const mappings = db.prepare(sql).all(...params);
  res.json(mappings);
});

router.post('/sku-mappings', (req, res) => {
  const { sku_code, sku_name, alias, category } = req.body;
  
  if (!sku_code || !sku_name) {
    return res.status(400).json({ error: 'sku_code 和 sku_name 为必填项' });
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO sku_mappings (sku_code, sku_name, alias, category)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(sku_code, sku_name, alias || null, category || null);
    res.json({ id: result.lastInsertRowid, sku_code, sku_name, alias, category });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/locations', (req, res) => {
  const locations = db.prepare('SELECT * FROM locations ORDER BY location_code').all();
  res.json(locations);
});

router.post('/locations', (req, res) => {
  const { location_code, location_name, manager } = req.body;
  
  if (!location_code || !location_name) {
    return res.status(400).json({ error: 'location_code 和 location_name 为必填项' });
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO locations (location_code, location_name, manager)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(location_code, location_name, manager || null);
    res.json({ id: result.lastInsertRowid, location_code, location_name, manager });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
