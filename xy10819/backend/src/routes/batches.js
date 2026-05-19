const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const batches = await db.all(`
      SELECT b.*, c.name as collection_name
      FROM batches b
      LEFT JOIN collections c ON b.collection_id = c.id
      ORDER BY b.created_at DESC
      LIMIT 50
    `);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/collection/:collectionId', async (req, res) => {
  try {
    const batches = await db.all(`
      SELECT * FROM batches 
      WHERE collection_id = ? 
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.params.collectionId]);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/results', async (req, res) => {
  try {
    const results = await db.all(`
      SELECT er.*, s.name as step_name, s.method, s.url
      FROM execution_results er
      LEFT JOIN steps s ON er.step_id = s.id
      WHERE er.batch_id = ?
      ORDER BY er.executed_at ASC
    `, [req.params.id]);
    
    res.json(results.map(r => ({
      ...r,
      request_data: JSON.parse(r.request_data || '{}'),
      response_data: JSON.parse(r.response_data || '{}'),
      assertions_result: JSON.parse(r.assertions_result || '[]')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { collection_id } = req.body;
    const id = uuidv4();
    
    const steps = await db.all('SELECT COUNT(*) as count FROM steps WHERE collection_id = ?', [collection_id]);
    
    await db.run(
      `INSERT INTO batches (id, collection_id, status, total_steps, started_at) 
       VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP)`,
      [id, collection_id, steps[0].count]
    );
    
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [id]);
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, passed_steps, failed_steps } = req.body;
    const updates = [];
    const params = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (passed_steps !== undefined) {
      updates.push('passed_steps = ?');
      params.push(passed_steps);
    }
    if (failed_steps !== undefined) {
      updates.push('failed_steps = ?');
      params.push(failed_steps);
    }
    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
    
    params.push(req.params.id);
    
    await db.run(
      `UPDATE batches SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM batches WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
