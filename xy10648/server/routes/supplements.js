const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function logOperation(operationType, targetType, targetId, operator, details, oldValue = null, newValue = null) {
  const now = new Date().toISOString();
  return runAsync(
    `INSERT INTO operation_logs (operation_type, target_type, target_id, operator, details, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [operationType, targetType, targetId, operator, details, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, now]
  );
}

router.get('/', async (req, res) => {
  try {
    const supplements = await allAsync('SELECT * FROM supplement_requests ORDER BY created_at DESC');
    res.json(supplements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const supplement = await getAsync('SELECT * FROM supplement_requests WHERE id = ?', [req.params.id]);
    if (!supplement) {
      return res.status(404).json({ error: 'Supplement request not found' });
    }
    res.json(supplement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { review_id, request_type, description, requested_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    await runAsync(
      `INSERT INTO supplement_requests (id, review_id, request_type, description, status, requested_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, review_id, request_type, description, requested_by, now, now]
    );

    await logOperation('create', 'supplement', id, requested_by, `发起补资料请求: ${description}`);

    const supplement = await getAsync('SELECT * FROM supplement_requests WHERE id = ?', [id]);
    res.status(201).json(supplement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/respond', async (req, res) => {
  const { status, responded_by, response } = req.body;
  const now = new Date().toISOString();

  try {
    const oldSupplement = await getAsync('SELECT * FROM supplement_requests WHERE id = ?', [req.params.id]);
    if (!oldSupplement) {
      return res.status(404).json({ error: 'Supplement request not found' });
    }

    await runAsync(
      `UPDATE supplement_requests SET status = ?, responded_by = ?, response = ?, responded_at = ?, updated_at = ? WHERE id = ?`,
      [status, responded_by, response, now, now, req.params.id]
    );

    const newSupplement = await getAsync('SELECT * FROM supplement_requests WHERE id = ?', [req.params.id]);

    await logOperation('respond', 'supplement', req.params.id, responded_by, `回复补资料请求: ${response || ''}`, { status: oldSupplement.status }, { status: status });

    res.json(newSupplement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
