const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const db = require('./database');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/api/deposits', (req, res) => {
  const data = req.body;
  const depositNo = 'DP' + Date.now();
  
  const sql = `
    INSERT INTO deposits (
      deposit_no, student_name, student_phone, instrument_type,
      instrument_brand, instrument_model, instrument_serial,
      deposit_amount, rental_start_date, expected_return_date,
      status, store, manager, string_condition, body_condition,
      damage_description, damage_type, deduction_amount, refund_amount,
      evidence_photos, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    depositNo, data.student_name, data.student_phone, data.instrument_type,
    data.instrument_brand, data.instrument_model, data.instrument_serial,
    data.deposit_amount, data.rental_start_date, data.expected_return_date,
    data.status || 'active', data.store, data.manager, data.string_condition,
    data.body_condition, data.damage_description, data.damage_type,
    data.deduction_amount || 0, data.refund_amount,
    data.evidence_photos, data.notes
  ];
  
  db.run(sql, params, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, deposit_no: depositNo });
  });
});

app.put('/api/deposits/:id', (req, res) => {
  const id = req.params.id;
  const data = req.body;
  
  db.get('SELECT * FROM deposits WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const updated = { ...row, ...data };
    
    const sql = `
      UPDATE deposits SET
        student_name = ?, student_phone = ?, instrument_type = ?,
        instrument_brand = ?, instrument_model = ?, instrument_serial = ?,
        deposit_amount = ?, rental_start_date = ?, expected_return_date = ?,
        actual_return_date = ?, status = ?, store = ?, manager = ?,
        string_condition = ?, body_condition = ?, damage_description = ?,
        damage_type = ?, deduction_amount = ?, refund_amount = ?,
        evidence_photos = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const params = [
      updated.student_name, updated.student_phone, updated.instrument_type,
      updated.instrument_brand, updated.instrument_model, updated.instrument_serial,
      updated.deposit_amount, updated.rental_start_date, updated.expected_return_date,
      updated.actual_return_date, updated.status, updated.store, updated.manager,
      updated.string_condition, updated.body_condition, updated.damage_description,
      updated.damage_type, updated.deduction_amount, updated.refund_amount,
      updated.evidence_photos, updated.notes, id
    ];
    
    db.run(sql, params, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Updated successfully' });
    });
  });
});

app.get('/api/deposits', (req, res) => {
  let sql = 'SELECT * FROM deposits WHERE 1=1';
  let params = [];
  
  if (req.query.status) {
    sql += ' AND status = ?';
    params.push(req.query.status);
  }
  
  if (req.query.store) {
    sql += ' AND store = ?';
    params.push(req.query.store);
  }
  
  if (req.query.manager) {
    sql += ' AND manager = ?';
    params.push(req.query.manager);
  }
  
  if (req.query.start_date) {
    sql += ' AND rental_start_date >= ?';
    params.push(req.query.start_date);
  }
  
  if (req.query.end_date) {
    sql += ' AND rental_start_date <= ?';
    params.push(req.query.end_date);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/deposits/:id', (req, res) => {
  db.get('SELECT * FROM deposits WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(row);
  });
});

app.get('/api/deposits/export/csv', (req, res) => {
  let sql = 'SELECT * FROM deposits WHERE 1=1';
  let params = [];
  
  if (req.query.status) {
    sql += ' AND status = ?';
    params.push(req.query.status);
  }
  
  if (req.query.store) {
    sql += ' AND store = ?';
    params.push(req.query.store);
  }
  
  if (req.query.manager) {
    sql += ' AND manager = ?';
    params.push(req.query.manager);
  }
  
  if (req.query.start_date) {
    sql += ' AND rental_start_date >= ?';
    params.push(req.query.start_date);
  }
  
  if (req.query.end_date) {
    sql += ' AND rental_start_date <= ?';
    params.push(req.query.end_date);
  }
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const fields = [
      'id', 'deposit_no', 'student_name', 'student_phone',
      'instrument_type', 'instrument_brand', 'instrument_model',
      'instrument_serial', 'deposit_amount', 'rental_start_date',
      'expected_return_date', 'actual_return_date', 'status',
      'store', 'manager', 'string_condition', 'body_condition',
      'damage_description', 'damage_type', 'deduction_amount',
      'refund_amount', 'evidence_photos', 'notes', 'created_at', 'updated_at'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('deposits.csv');
    res.send(csv);
  });
});

app.post('/api/deposits/batch', upload.single('file'), (req, res) => {
  const results = [];
  const errors = [];
  let rowNumber = 0;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      rowNumber++;
      results.push({ row: rowNumber, data: row });
    })
    .on('end', () => {
      processBatch(results, (batchResults) => {
        fs.unlinkSync(req.file.path);
        res.json({
          total: results.length,
          success: batchResults.filter(r => r.success).length,
          failed: batchResults.filter(r => !r.success).length,
          results: batchResults
        });
      });
    });
});

function processBatch(rows, callback) {
  const results = [];
  let processed = 0;
  
  rows.forEach((item) => {
    const data = item.data;
    const depositNo = data.deposit_no || 'DP' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    const sql = `
      INSERT INTO deposits (
        deposit_no, student_name, student_phone, instrument_type,
        instrument_brand, instrument_model, instrument_serial,
        deposit_amount, rental_start_date, expected_return_date,
        status, store, manager, string_condition, body_condition,
        damage_description, damage_type, deduction_amount, refund_amount,
        evidence_photos, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      depositNo, data.student_name, data.student_phone, data.instrument_type,
      data.instrument_brand, data.instrument_model, data.instrument_serial,
      parseFloat(data.deposit_amount) || 0, data.rental_start_date,
      data.expected_return_date, data.status || 'active', data.store,
      data.manager, data.string_condition, data.body_condition,
      data.damage_description, data.damage_type,
      parseFloat(data.deduction_amount) || 0,
      data.refund_amount ? parseFloat(data.refund_amount) : null,
      data.evidence_photos, data.notes
    ];
    
    db.run(sql, params, function(err) {
      processed++;
      
      if (err) {
        results.push({
          row: item.row, success: false, deposit_no: depositNo, error: err.message });
      } else {
        results.push({
          row: item.row, success: true, deposit_no: depositNo, id: this.lastID
        });
      }
      
      if (processed === rows.length) {
        callback(results);
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}');
});
