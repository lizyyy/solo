const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

router.get('/', (req, res) => {
  db.all('SELECT * FROM chemical_batches ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const updatedRows = rows.map(batch => {
      const isExpired = moment(batch.expiry_date).isBefore(moment());
      const isAboutToExpire = moment(batch.expiry_date).isBetween(moment(), moment().add(30, 'days'));
      
      let currentStatus = batch.status;
      if (isExpired && batch.status === '可用') {
        currentStatus = '已过期';
      } else if (isAboutToExpire && batch.status === '可用') {
        currentStatus = '即将过期';
      }
      
      return {
        ...batch,
        is_expired: isExpired,
        is_about_to_expire: isAboutToExpire,
        current_status: currentStatus
      };
    });
    
    res.json(updatedRows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM chemical_batches WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '药剂批次不存在' });
    }
    
    const isExpired = moment(row.expiry_date).isBefore(moment());
    const isAboutToExpire = moment(row.expiry_date).isBetween(moment(), moment().add(30, 'days'));
    
    let currentStatus = row.status;
    if (isExpired && row.status === '可用') {
      currentStatus = '已过期';
    } else if (isAboutToExpire && row.status === '可用') {
      currentStatus = '即将过期';
    }
    
    res.json({
      ...row,
      is_expired: isExpired,
      is_about_to_expire: isAboutToExpire,
      current_status: currentStatus
    });
  });
});

router.get('/batch/:batchNumber', (req, res) => {
  db.get('SELECT * FROM chemical_batches WHERE batch_number = ?', [req.params.batchNumber], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '药剂批次不存在' });
    }
    
    const isExpired = moment(row.expiry_date).isBefore(moment());
    const isAboutToExpire = moment(row.expiry_date).isBetween(moment(), moment().add(30, 'days'));
    
    res.json({
      ...row,
      is_expired: isExpired,
      is_about_to_expire: isAboutToExpire
    });
  });
});

router.get('/status/:status', (req, res) => {
  db.all('SELECT * FROM chemical_batches WHERE status = ? ORDER BY expiry_date', [req.params.status], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { batch_number, chemical_name, manufacturer, production_date, expiry_date, quantity, status } = req.body;
  
  db.get('SELECT id FROM chemical_batches WHERE batch_number = ?', [batch_number], (err, existingBatch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (existingBatch) {
      return res.status(400).json({ error: '批次号已存在' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO chemical_batches (batch_number, chemical_name, manufacturer, production_date, expiry_date, quantity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      batch_number,
      chemical_name,
      manufacturer || null,
      production_date,
      expiry_date,
      quantity || 0,
      status || '可用',
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
          id: this.lastID,
          message: '药剂批次创建成功'
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id', (req, res) => {
  const { batch_number, chemical_name, manufacturer, production_date, expiry_date, quantity, status } = req.body;
  
  const stmt = db.prepare(`
    UPDATE chemical_batches 
    SET batch_number = ?, chemical_name = ?, manufacturer = ?, production_date = ?, expiry_date = ?, quantity = ?, status = ?
    WHERE id = ?
  `);
  
  stmt.run(
    batch_number,
    chemical_name,
    manufacturer || null,
    production_date,
    expiry_date,
    quantity || 0,
    status || '可用',
    req.params.id,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '药剂批次不存在' });
      }
      res.json({ message: '药剂批次更新成功' });
    }
  );
  stmt.finalize();
});

router.put('/:id/use', (req, res) => {
  const { quantity_used } = req.body;
  
  db.get('SELECT * FROM chemical_batches WHERE id = ?', [req.params.id], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '药剂批次不存在' });
    }
    
    const isExpired = moment(batch.expiry_date).isBefore(moment());
    if (isExpired) {
      return res.status(400).json({ error: '该药剂批次已过期，无法使用' });
    }
    
    if (batch.quantity < quantity_used) {
      return res.status(400).json({ error: '药剂数量不足' });
    }
    
    const newQuantity = batch.quantity - quantity_used;
    const newStatus = newQuantity <= 0 ? '已用完' : batch.status;
    
    const stmt = db.prepare(`
      UPDATE chemical_batches 
      SET quantity = ?, status = ?
      WHERE id = ?
    `);
    
    stmt.run(
      newQuantity,
      newStatus,
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: '药剂使用成功',
          remaining_quantity: newQuantity
        });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM chemical_batches WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '药剂批次不存在' });
    }
    res.json({ message: '药剂批次删除成功' });
  });
});

module.exports = router;
