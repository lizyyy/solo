const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { get, all } = require('../database');

router.get('/inventory', async (req, res) => {
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

router.get('/sales', async (req, res) => {
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

router.get('/replenishment', async (req, res) => {
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

router.get('/batch/:batchId/report', async (req, res) => {
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

module.exports = router;
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/replenishment', async (req, res) => {
  const { location_code, sku_code, batch_id, difference_type, near_expiry } = req.query;
  
  let sql = `
    SELECT r.id, b.batch_no, b.location_code, r.sku_code, r.sku_name,
           r.expected_qty, r.actual_qty, 
           (r.actual_qty - r.expected_qty) as difference,
           r.difference_type, r.unit_price, r.expiry_date, r.is_near_expiry, r.created_at
    FROM replenishment_records r
    JOIN batches b ON r.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (location_code) {
    sql += ' AND b.location_code = ?';
    params.push(location_code);
  }
  if (sku_code) {
    sql += ' AND r.sku_code = ?';
    params.push(sku_code);
  }
  if (batch_id) {
    sql += ' AND r.batch_id = ?';
    params.push(batch_id);
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
    
    const fields = [
      'id', 'batch_no', 'location_code', 'sku_code', 'sku_name',
      'expected_qty', 'actual_qty', 'difference', 'difference_type',
      'unit_price', 'expiry_date', 'is_near_expiry', 'created_at'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="replenishment_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batch/:batchId/report', async (req, res) => {
  const batchId = req.params.batchId;
  
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
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
    
    const report = {
      batch_info: batch,
      summary: {
        inventory_records: inventory.length,
        inventory_total_quantity: totalInventoryQty,
        sales_records: sales.length,
        sales_total_amount: totalSalesAmount,
        replenishment_records: replenishment.length,
        over_replenishment_count: overReplenish,
        under_replenishment_count: underReplenish,
        near_expiry_count: nearExpiryCount,
        alias_detections: aliases.length,
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
        final_status: batch.status,
        last_action: logs[0] || null,
        handler: batch.handler,
        responsible_person: batch.responsible_person
      }
    };
    
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
  let sql = `
    SELECT r.id, b.batch_no, b.location_code, r.sku_code, r.sku_name,
           r.expected_qty, r.actual_qty, r.difference, r.difference_type,
           r.unit_price, r.expiry_date, r.is_near_expiry, r.created_at
    FROM replenishment_records r
    JOIN batches b ON r.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (location_code) {
    sql += ' AND b.location_code = ?';
    params.push(location_code);
  }
  if (sku_code) {
    sql += ' AND r.sku_code = ?';
    params.push(sku_code);
  }
  if (batch_id) {
    sql += ' AND r.batch_id = ?';
    params.push(batch_id);
  }
  if (difference_type) {
    sql += ' AND r.difference_type = ?';
    params.push(difference_type);
  }
  if (near_expiry === 'true') {
    sql += ' AND r.is_near_expiry = 1';
  }
  
  sql += ' ORDER BY r.created_at DESC';
  
  const records = db.prepare(sql).all(...params);
  
  const fields = [
    'id', 'batch_no', 'location_code', 'sku_code', 'sku_name',
    'expected_qty', 'actual_qty', 'difference', 'difference_type',
    'unit_price', 'expiry_date', 'is_near_expiry', 'created_at'
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="replenishment_${Date.now()}.csv"`);
  res.send('\uFEFF' + csv);
});

router.get('/batch/:batchId/report', (req, res) => {
  const batchId = req.params.batchId;
  
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  const inventory = db.prepare('SELECT * FROM inventory_records WHERE batch_id = ?').all(batchId);
  const sales = db.prepare('SELECT * FROM sales_records WHERE batch_id = ?').all(batchId);
  const replenishment = db.prepare('SELECT * FROM replenishment_records WHERE batch_id = ?').all(batchId);
  const logs = db.prepare('SELECT * FROM processing_logs WHERE batch_id = ? ORDER BY created_at DESC').all(batchId);
  const aliases = db.prepare('SELECT * FROM sku_alias_detections WHERE batch_id = ?').all(batchId);
  
  const totalInventoryQty = inventory.reduce((sum, r) => sum + r.quantity, 0);
  const totalSalesAmount = sales.reduce((sum, r) => sum + r.amount, 0);
  const overReplenish = replenishment.filter(r => r.difference_type === 'over').length;
  const underReplenish = replenishment.filter(r => r.difference_type === 'under').length;
  const nearExpiryCount = [...inventory, ...replenishment].filter(r => r.is_near_expiry).length;
  
  const report = {
    batch_info: batch,
    summary: {
      inventory_records: inventory.length,
      inventory_total_quantity: totalInventoryQty,
      sales_records: sales.length,
      sales_total_amount: totalSalesAmount,
      replenishment_records: replenishment.length,
      over_replenishment_count: overReplenish,
      under_replenishment_count: underReplenish,
      near_expiry_count: nearExpiryCount,
      alias_detections: aliases.length,
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
      final_status: batch.status,
      last_action: logs[0] || null,
      handler: batch.handler,
      responsible_person: batch.responsible_person
    }
  };
  
  res.json(report);
});

module.exports = router;
