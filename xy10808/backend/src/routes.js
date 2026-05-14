const express = require('express');
const router = express.Router();
const db = require('./database');
const SignatureService = require('./signatureService');
const { Parser } = require('json2csv');

router.post('/api/merchants', (req, res) => {
  const { merchant_id, merchant_name, secret_key, algorithm, time_window } = req.body;
  
  db.run(
    `INSERT INTO merchant_configs (merchant_id, merchant_name, secret_key, algorithm, time_window)
     VALUES (?, ?, ?, ?, ?)`,
    [merchant_id, merchant_name, secret_key, algorithm || 'HMAC-SHA256', time_window || 300],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ id: this.lastID, merchant_id, success: true });
    }
  );
});

router.get('/api/merchants', (req, res) => {
  db.all('SELECT id, merchant_id, merchant_name, algorithm, time_window, created_at, updated_at FROM merchant_configs ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/api/records', (req, res) => {
  const { merchant_id, payload, signature, timestamp, nonce } = req.body;
  const record_id = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  db.run(
    `INSERT INTO signature_records (record_id, merchant_id, original_payload, signature, timestamp, nonce, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record_id, merchant_id, JSON.stringify(payload), signature, timestamp, nonce || null, 'PENDING'],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      
      db.get('SELECT * FROM signature_records WHERE record_id = ?', [record_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
      });
    }
  );
});

router.get('/api/records', (req, res) => {
  const { status, merchant_id, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM signature_records WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (merchant_id) {
    query += ' AND merchant_id = ?';
    params.push(merchant_id);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, original_payload: JSON.parse(r.original_payload) })));
  });
});

router.get('/api/records/:recordId', (req, res) => {
  db.get('SELECT * FROM signature_records WHERE record_id = ?', [req.params.recordId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Record not found' });
    
    db.all('SELECT * FROM verification_history WHERE record_id = ? ORDER BY created_at ASC', [req.params.recordId], (historyErr, history) => {
      if (historyErr) return res.status(500).json({ error: historyErr.message });
      res.json({
        ...row,
        original_payload: JSON.parse(row.original_payload),
        history
      });
    });
  });
});

router.post('/api/records/:recordId/verify', async (req, res) => {
  try {
    const { recordId } = req.params;
    
    db.get('SELECT * FROM signature_records WHERE record_id = ?', [recordId], async (err, record) => {
      if (err) throw err;
      if (!record) return res.status(404).json({ error: 'Record not found' });
      
      db.get('SELECT * FROM merchant_configs WHERE merchant_id = ?', [record.merchant_id], async (configErr, config) => {
        if (configErr) throw configErr;
        if (!config) return res.status(400).json({ error: 'Merchant config not found' });
        
        const result = await SignatureService.verifySignature(recordId, config);
        res.json(result);
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/records/:recordId/retry', async (req, res) => {
  const { recordId } = req.params;
  
  db.get('SELECT * FROM signature_records WHERE record_id = ?', [recordId], async (err, record) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!record) return res.status(404).json({ error: 'Record not found' });
    
    const newRecordId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    db.run(
      `INSERT INTO signature_records (record_id, merchant_id, original_payload, signature, timestamp, nonce, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newRecordId, record.merchant_id, record.original_payload, record.signature, record.timestamp, record.nonce, 'PENDING'],
      function(insertErr) {
        if (insertErr) return res.status(400).json({ error: insertErr.message });
        
        db.get('SELECT * FROM merchant_configs WHERE merchant_id = ?', [record.merchant_id], async (configErr, config) => {
          if (configErr) return res.status(500).json({ error: configErr.message });
          
          const result = await SignatureService.verifySignature(newRecordId, config);
          
          db.get('SELECT * FROM signature_records WHERE record_id = ?', [newRecordId], (getErr, newRecord) => {
            if (getErr) return res.status(500).json({ error: getErr.message });
            res.json({
              ...newRecord,
              original_payload: JSON.parse(newRecord.original_payload),
              verifyResult: result
            });
          });
        });
      }
    );
  });
});

router.post('/api/records/:recordId/save-sample', async (req, res) => {
  try {
    const { notes } = req.body;
    const result = await SignatureService.saveToSampleLibrary(req.params.recordId, notes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/samples', (req, res) => {
  const { merchant_id, is_success } = req.query;
  let query = 'SELECT * FROM sample_library WHERE 1=1';
  const params = [];
  
  if (merchant_id) {
    query += ' AND merchant_id = ?';
    params.push(merchant_id);
  }
  if (is_success !== undefined) {
    query += ' AND is_success = ?';
    params.push(is_success);
  }
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })));
  });
});

router.get('/api/export/records', (req, res) => {
  db.all('SELECT * FROM signature_records ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const data = rows.map(r => ({
      record_id: r.record_id,
      merchant_id: r.merchant_id,
      payload: r.original_payload,
      signature: r.signature,
      timestamp: r.timestamp,
      status: r.status,
      error_message: r.error_message,
      created_at: r.created_at
    }));
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('signature_records.csv');
    res.send(csv);
  });
});

router.get('/api/export/samples', (req, res) => {
  db.all('SELECT * FROM sample_library ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const data = rows.map(r => ({
      sample_id: r.sample_id,
      merchant_id: r.merchant_id,
      payload: r.payload,
      signature: r.signature,
      expected_signature: r.expected_signature,
      is_success: r.is_success,
      notes: r.notes,
      created_at: r.created_at
    }));
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('signature_samples.csv');
    res.send(csv);
  });
});

router.post('/api/generate-signature', (req, res) => {
  const { payload, secret_key, algorithm } = req.body;
  const signature = SignatureService.generateSignature(payload, secret_key, algorithm);
  res.json({ signature, payload });
});

module.exports = router;
