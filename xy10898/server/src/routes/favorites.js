const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getQuery, allQuery, runQuery } = require('../database');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { request_id, user_id, note } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    const existing = await getQuery(
      'SELECT * FROM favorites WHERE request_id = ? AND user_id = ?',
      [request_id, user_id || 'anonymous']
    );

    if (existing) {
      return res.status(409).json({ error: 'Already favorited' });
    }

    const id = uuidv4();
    await runQuery(
      'INSERT INTO favorites (id, request_id, user_id, note) VALUES (?, ?, ?, ?)',
      [id, request_id, user_id || 'anonymous', note || '']
    );

    const favorite = await getQuery('SELECT * FROM favorites WHERE id = ?', [id]);
    
    res.status(201).json(favorite);
  } catch (error) {
    console.error('Create favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    const favorites = await allQuery(
      `SELECT f.*, r.name as request_name, r.method, r.url, r.status
       FROM favorites f
       JOIN requests r ON f.request_id = r.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [user_id || 'anonymous']
    );
    
    res.json(favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM favorites WHERE id = ?', [req.params.id]);
    res.json({ message: 'Favorite removed' });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
