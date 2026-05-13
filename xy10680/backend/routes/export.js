const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const db = require('../database');

router.get('/employees', (req, res) => {
  const { department, status } = req.query;
  let query = 'SELECT * FROM employees WHERE 1=1';
  const params = [];
  
  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const fields = ['id', 'employee_id', 'name', 'department', 'size', 'status', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('employees.csv');
    res.send(csv);
  });
});

router.get('/exchanges', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT er.request_id, e.name as employee_name, e.employee_id, er.old_size, 
           er.new_size, er.reason, er.status, er.failure_reason, er.created_at
    FROM exchange_requests er
    JOIN employees e ON er.employee_id = e.id
  `;
  const params = [];
  
  if (status) {
    query += ' WHERE er.status = ?';
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const fields = ['request_id', 'employee_id', 'employee_name', 'old_size', 'new_size', 'reason', 'status', 'failure_reason', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('exchanges.csv');
    res.send(csv);
  });
});

router.get('/recoveries', (req, res) => {
  const query = `
    SELECT r.recovery_id, e.name as employee_name, e.employee_id, r.size, 
           r.quantity, r.recovery_date, r.status, r.is_exception, r.exception_reason, r.created_at
    FROM recoveries r
    JOIN employees e ON r.employee_id = e.id
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const fields = ['recovery_id', 'employee_id', 'employee_name', 'size', 'quantity', 'recovery_date', 'status', 'is_exception', 'exception_reason', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('recoveries.csv');
    res.send(csv);
  });
});

router.get('/inventory', (req, res) => {
  db.all('SELECT * FROM inventory ORDER BY size', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const fields = ['id', 'size', 'quantity', 'updated_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('inventory.csv');
    res.send(csv);
  });
});

router.get('/timeline', (req, res) => {
  db.all('SELECT * FROM timeline ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const result = rows.map(row => ({
      ...row,
      event_data: JSON.stringify(row.event_data)
    }));
    
    const fields = ['id', 'event_type', 'event_data', 'status', 'description', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(result);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('timeline.csv');
    res.send(csv);
  });
});

module.exports = router;