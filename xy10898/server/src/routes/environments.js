const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getQuery, allQuery, runQuery } = require('../database');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, description, variables } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = uuidv4();
    await runQuery(
      'INSERT INTO environments (id, name, description, variables) VALUES (?, ?, ?, ?)',
      [id, name, description || '', JSON.stringify(variables || {})]
    );

    const env = await getQuery('SELECT * FROM environments WHERE id = ?', [id]);
    
    res.status(201).json({
      ...env,
      variables: JSON.parse(env.variables || '{}')
    });
  } catch (error) {
    console.error('Create environment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const environments = await allQuery('SELECT * FROM environments ORDER BY created_at DESC');
    
    res.json(environments.map(e => ({
      ...e,
      variables: JSON.parse(e.variables || '{}')
    })));
  } catch (error) {
    console.error('Get environments error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const env = await getQuery('SELECT * FROM environments WHERE id = ?', [req.params.id]);
    
    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    res.json({
      ...env,
      variables: JSON.parse(env.variables || '{}')
    });
  } catch (error) {
    console.error('Get environment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, description, variables } = req.body;
    const env = await getQuery('SELECT * FROM environments WHERE id = ?', [req.params.id]);

    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (variables !== undefined) {
      updates.push('variables = ?');
      params.push(JSON.stringify(variables));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      
      await runQuery(
        `UPDATE environments SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const updated = await getQuery('SELECT * FROM environments WHERE id = ?', [req.params.id]);
    
    res.json({
      ...updated,
      variables: JSON.parse(updated.variables || '{}')
    });
  } catch (error) {
    console.error('Update environment error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
