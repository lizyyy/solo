const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll, generateId } = require('../utils/dbHelper');

router.get('/', async (req, res) => {
  try {
    const skills = await getAll(`
      SELECT s.*, COUNT(vs.volunteer_id) as volunteer_count
      FROM skills s
      LEFT JOIN volunteer_skills vs ON s.id = vs.skill_id
      GROUP BY s.id
      ORDER BY s.name
    `);
    res.json(skills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const skill = await getOne(`
      SELECT s.*, COUNT(vs.volunteer_id) as volunteer_count
      FROM skills s
      LEFT JOIN volunteer_skills vs ON s.id = vs.skill_id
      WHERE s.id = ?
      GROUP BY s.id
    `, [id]);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    const volunteers = await getAll(`
      SELECT v.*
      FROM volunteers v
      JOIN volunteer_skills vs ON v.id = vs.volunteer_id
      WHERE vs.skill_id = ?
    `, [id]);
    
    skill.volunteers = volunteers;
    res.json(skill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO skills (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `, [id, name, description || '', now]);
    
    const newSkill = await getOne('SELECT * FROM skills WHERE id = ?', [id]);
    res.status(201).json(newSkill);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Skill already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const existing = await getOne('SELECT * FROM skills WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    await runQuery(`
      UPDATE skills 
      SET name = ?, description = ?
      WHERE id = ?
    `, [name || existing.name, description ?? existing.description, id]);
    
    const updatedSkill = await getOne('SELECT * FROM skills WHERE id = ?', [id]);
    res.json(updatedSkill);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Skill already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getOne('SELECT * FROM skills WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    await runQuery('DELETE FROM skills WHERE id = ?', [id]);
    res.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
