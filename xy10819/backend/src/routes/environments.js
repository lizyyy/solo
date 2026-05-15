const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const environments = await db.all('SELECT * FROM environments ORDER BY created_at DESC');
    res.json(environments.map(env => ({
      ...env,
      variables: JSON.parse(env.variables || '[]')
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const env = await db.get('SELECT * FROM environments WHERE id = ?', [req.params.id]);
    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json({
      ...env,
      variables: JSON.parse(env.variables || '[]')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, variables } = req.body;
    const id = uuidv4();
    await db.run(
      'INSERT INTO environments (id, name, variables) VALUES (?, ?, ?)',
      [id, name, JSON.stringify(variables || [])]
    );
    const environment = await db.get('SELECT * FROM environments WHERE id = ?', [id]);
    res.status(201).json({
      ...environment,
      variables: JSON.parse(environment.variables || '[]')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, variables } = req.body;
    await db.run(
      'UPDATE environments SET name = ?, variables = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, JSON.stringify(variables || []), req.params.id]
    );
    const environment = await db.get('SELECT * FROM environments WHERE id = ?', [req.params.id]);
    res.json({
      ...environment,
      variables: JSON.parse(environment.variables || '[]')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM environments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
