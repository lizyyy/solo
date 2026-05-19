const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const IdempotencyService = require('../services/idempotencyService');

router.post('/', async (req, res) => {
  const { idempotency_key, snippet_id, data_source_id, priority } = req.body;

  if (idempotency_key) {
    try {
      const existingResponse = await IdempotencyService.checkIdempotency(idempotency_key, 'create_refresh_task');
      if (existingResponse) {
        return res.json({ ...existingResponse, is_idempotent: true });
      }
    } catch (err) {
      console.error('幂等检查失败', err);
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO refresh_tasks (id, snippet_id, data_source_id, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, snippet_id, data_source_id, priority || 'normal', now, now],
    async function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const response = { id, snippet_id, data_source_id, status: 'pending', created_at: now };
      if (idempotency_key) {
        try {
          await IdempotencyService.saveIdempotency(idempotency_key, 'create_refresh_task', response);
        } catch (e) {
          console.error('保存幂等键失败', e);
        }
      }
      res.status(201).json(response);
    }
  );
});

router.get('/', (req, res) => {
  const { status, data_source_id, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM refresh_tasks';
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (data_source_id) {
    conditions.push('data_source_id = ?');
    params.push(data_source_id);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM refresh_tasks WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '刷新任务不存在' });
    }
    res.json(row);
  });
});

router.put('/:id/status', (req, res) => {
  const { status, error_message } = req.body;
  const now = new Date().toISOString();

  let query = 'UPDATE refresh_tasks SET status = ?, updated_at = ?';
  const params = [status, now];

  if (status === 'running') {
    query += ', started_at = ?';
    params.push(now);
  } else if (status === 'completed' || status === 'failed') {
    query += ', completed_at = ?';
    params.push(now);
  }

  if (status === 'failed' && error_message) {
    query += ', error_message = ?';
    params.push(error_message);
  }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  db.run(query, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '刷新任务不存在' });
    }
    res.json({ id: req.params.id, status, updated_at: now });
  });
});

router.post('/:id/retry', (req, res) => {
  const now = new Date().toISOString();

  db.run(
    'UPDATE refresh_tasks SET status = ?, retry_count = retry_count + 1, updated_at = ?, started_at = NULL, completed_at = NULL, error_message = NULL WHERE id = ?',
    ['pending', now, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '刷新任务不存在' });
      }
      res.json({ id: req.params.id, status: 'pending', message: '已重新加入队列' });
    }
  );
});

router.post('/:id/manual-fix', (req, res) => {
  const { fixed_by, fix_note } = req.body;
  const now = new Date().toISOString();

  db.run(
    'UPDATE refresh_tasks SET status = ?, is_manual_fix = 1, fixed_by = ?, fixed_at = ?, fix_note = ?, updated_at = ? WHERE id = ?',
    ['completed', fixed_by, now, fix_note, now, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '刷新任务不存在' });
      }
      res.json({ id: req.params.id, status: 'completed', is_manual_fix: true, fixed_at: now });
    }
  );
});

module.exports = router;
