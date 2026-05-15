const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/', (req, res) => {
  const { batch_no, source_system, finance_type, amount, transfer_date, handler, handler_department } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  let status = 'success';
  let error_type = null;
  let error_message = null;

  if (!handler) {
    status = 'error';
    error_type = 'handler_missing';
    error_message = '负责人信息缺失';
  }

  db.run(
    'INSERT INTO transfer_records (id, batch_no, source_system, finance_type, amount, transfer_date, handler, handler_department, status, error_type, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, batch_no, source_system, finance_type, amount, transfer_date, handler, handler_department, status, error_type, error_message, now, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id,
        batch_no,
        source_system,
        finance_type,
        amount,
        transfer_date,
        handler,
        handler_department,
        status,
        error_type,
        error_message
      });
    }
  );
});

router.get('/', (req, res) => {
  const { status, batch_no, source_system } = req.query;
  
  let query = 'SELECT * FROM transfer_records WHERE 1=1';
  let params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (batch_no) {
    query += ' AND batch_no = ?';
    params.push(batch_no);
  }
  if (source_system) {
    query += ' AND source_system = ?';
    params.push(source_system);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/query', (req, res) => {
  const { keyword, status } = req.query;
  
  let query = `
    SELECT 
      tr.*,
      ph.operator as last_operator,
      ph.receipt_data,
      ms.content as material_summary
    FROM transfer_records tr
    LEFT JOIN process_history ph ON tr.id = ph.record_id
    LEFT JOIN material_summaries ms ON tr.id = ms.record_id
    WHERE 1=1
  `;
  let params = [];

  if (status) {
    query += ' AND tr.status = ?';
    params.push(status);
  }

  if (keyword) {
    query += ' AND (tr.batch_no LIKE ? OR tr.handler LIKE ? OR tr.finance_type LIKE ? OR tr.source_system LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }

  query += ' GROUP BY tr.id ORDER BY tr.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const successCount = rows.filter(r => r.status === 'success').length;
    const errorCount = rows.filter(r => r.status === 'error').length;
    
    res.json({
      total: rows.length,
      success_count: successCount,
      error_count: errorCount,
      data: rows
    });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM transfer_records WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(row);
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { handler, handler_department, status } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE transfer_records SET handler = ?, handler_department = ?, status = ?, updated_at = ? WHERE id = ?',
    [handler, handler_department, status || 'success', now, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json({ message: 'Record updated successfully' });
    }
  );
});

module.exports = router;
