const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll, generateId } = require('../utils/dbHelper');

router.get('/', async (req, res) => {
  try {
    const positions = await getAll(`
      SELECT p.*, 
             COUNT(DISTINCT dpr.date_id) as date_count,
             SUM(dpr.required_count) as total_required
      FROM positions p
      LEFT JOIN date_position_requirements dpr ON p.id = dpr.position_id
      GROUP BY p.id
      ORDER BY p.name
    `);
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const position = await getOne('SELECT * FROM positions WHERE id = ?', [id]);
    
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    
    const requirements = await getAll(`
      SELECT dpr.*, ed.date, ed.description as date_description
      FROM date_position_requirements dpr
      JOIN event_dates ed ON dpr.date_id = ed.id
      WHERE dpr.position_id = ?
    `, [id]);
    
    position.requirements = requirements;
    res.json(position);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, required_skills, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO positions (id, name, required_skills, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, name, JSON.stringify(required_skills || []), description || '', now, now]);
    
    const newPosition = await getOne('SELECT * FROM positions WHERE id = ?', [id]);
    if (newPosition) {
      newPosition.required_skills = JSON.parse(newPosition.required_skills || '[]');
    }
    res.status(201).json(newPosition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, required_skills, description } = req.body;
    
    const existing = await getOne('SELECT * FROM positions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Position not found' });
    }
    
    const now = new Date().toISOString();
    const skills = required_skills !== undefined ? JSON.stringify(required_skills) : existing.required_skills;
    
    await runQuery(`
      UPDATE positions 
      SET name = ?, required_skills = ?, description = ?, updated_at = ?
      WHERE id = ?
    `, [name || existing.name, skills, description ?? existing.description, now, id]);
    
    const updatedPosition = await getOne('SELECT * FROM positions WHERE id = ?', [id]);
    if (updatedPosition) {
      updatedPosition.required_skills = JSON.parse(updatedPosition.required_skills || '[]');
    }
    res.json(updatedPosition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getOne('SELECT * FROM positions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Position not found' });
    }
    
    await runQuery('DELETE FROM positions WHERE id = ?', [id]);
    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
