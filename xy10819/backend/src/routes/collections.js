const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const collections = await db.all(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM steps WHERE collection_id = c.id) as step_count,
             (SELECT COUNT(*) FROM batches WHERE collection_id = c.id AND status = 'completed') as batch_count
      FROM collections c
      ORDER BY c.created_at DESC
    `);
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const collection = await db.get('SELECT * FROM collections WHERE id = ?', [req.params.id]);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, environment_id } = req.body;
    const id = uuidv4();
    await db.run(
      'INSERT INTO collections (id, name, description, environment_id) VALUES (?, ?, ?, ?)',
      [id, name, description, environment_id]
    );
    const collection = await db.get('SELECT * FROM collections WHERE id = ?', [id]);
    res.status(201).json(collection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, environment_id, status } = req.body;
    await db.run(
      'UPDATE collections SET name = ?, description = ?, environment_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, environment_id, status, req.params.id]
    );
    const collection = await db.get('SELECT * FROM collections WHERE id = ?', [req.params.id]);
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM collections WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
