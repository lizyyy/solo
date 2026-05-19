const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function safeParseJSON(str, defaultValue = {}) {
  if (!str) return defaultValue;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

router.get('/collection/:collectionId', async (req, res) => {
  try {
    const steps = await db.all(
      'SELECT * FROM steps WHERE collection_id = ? ORDER BY order_index ASC',
      [req.params.collectionId]
    );
    res.json(steps.map(step => ({
      ...step,
      headers: JSON.parse(step.headers || '[]'),
      body: JSON.parse(step.body || '{}'),
      assertions: JSON.parse(step.assertions || '[]')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const step = await db.get('SELECT * FROM steps WHERE id = ?', [req.params.id]);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }
    res.json({
      ...step,
      headers: JSON.parse(step.headers || '[]'),
      body: JSON.parse(step.body || '{}'),
      assertions: JSON.parse(step.assertions || '[]')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { collection_id, name, method, url, headers, body, assertions, order_index } = req.body;
    const id = uuidv4();
    const parsedBody = safeParseJSON(body, {});
    await db.run(
      `INSERT INTO steps (id, collection_id, name, method, url, headers, body, assertions, order_index) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, collection_id, name, method, url, JSON.stringify(headers || []), 
       JSON.stringify(parsedBody), JSON.stringify(assertions || []), order_index || 0]
    );
    const step = await db.get('SELECT * FROM steps WHERE id = ?', [id]);
    res.status(201).json({
      ...step,
      headers: JSON.parse(step.headers || '[]'),
      body: JSON.parse(step.body || '{}'),
      assertions: JSON.parse(step.assertions || '[]')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, method, url, headers, body, assertions, order_index } = req.body;
    const parsedBody = safeParseJSON(body, {});
    await db.run(
      `UPDATE steps SET name = ?, method = ?, url = ?, headers = ?, body = ?, assertions = ?, order_index = ? 
       WHERE id = ?`,
      [name, method, url, JSON.stringify(headers || []), 
       JSON.stringify(parsedBody), JSON.stringify(assertions || []), order_index, req.params.id]
    );
    const step = await db.get('SELECT * FROM steps WHERE id = ?', [req.params.id]);
    res.json({
      ...step,
      headers: JSON.parse(step.headers || '[]'),
      body: JSON.parse(step.body || '{}'),
      assertions: JSON.parse(step.assertions || '[]')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM steps WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
