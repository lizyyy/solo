const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll, generateId } = require('../utils/dbHelper');

router.get('/', async (req, res) => {
  try {
    const eventDates = await getAll(`
      SELECT ed.*, 
             COUNT(DISTINCT dpr.position_id) as position_count,
             SUM(dpr.required_count) as total_required
      FROM event_dates ed
      LEFT JOIN date_position_requirements dpr ON ed.id = dpr.date_id
      GROUP BY ed.id
      ORDER BY ed.date
    `);
    res.json(eventDates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const eventDate = await getOne('SELECT * FROM event_dates WHERE id = ?', [id]);
    
    if (!eventDate) {
      return res.status(404).json({ error: 'Event date not found' });
    }
    
    const requirements = await getAll(`
      SELECT dpr.*, p.name as position_name, p.required_skills
      FROM date_position_requirements dpr
      JOIN positions p ON dpr.position_id = p.id
      WHERE dpr.date_id = ?
    `, [id]);
    
    eventDate.requirements = requirements;
    res.json(eventDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, description } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO event_dates (id, date, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, date, description || '', now, now]);
    
    const newEventDate = await getOne('SELECT * FROM event_dates WHERE id = ?', [id]);
    res.status(201).json(newEventDate);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Date already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, description } = req.body;
    
    const existing = await getOne('SELECT * FROM event_dates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Event date not found' });
    }
    
    const now = new Date().toISOString();
    await runQuery(`
      UPDATE event_dates 
      SET date = ?, description = ?, updated_at = ?
      WHERE id = ?
    `, [date || existing.date, description ?? existing.description, now, id]);
    
    const updatedEventDate = await getOne('SELECT * FROM event_dates WHERE id = ?', [id]);
    res.json(updatedEventDate);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ error: 'Date already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getOne('SELECT * FROM event_dates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Event date not found' });
    }
    
    await runQuery('DELETE FROM event_dates WHERE id = ?', [id]);
    res.json({ message: 'Event date deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/requirements', async (req, res) => {
  try {
    const { id: dateId } = req.params;
    const { position_id, required_count } = req.body;
    
    if (!position_id) {
      return res.status(400).json({ error: 'Position ID is required' });
    }
    
    const existingReq = await getOne(`
      SELECT * FROM date_position_requirements 
      WHERE date_id = ? AND position_id = ?
    `, [dateId, position_id]);
    
    const now = new Date().toISOString();
    let result;
    
    if (existingReq) {
      await runQuery(`
        UPDATE date_position_requirements 
        SET required_count = ?, updated_at = ?
        WHERE id = ?
      `, [required_count || 1, now, existingReq.id]);
      result = await getOne('SELECT * FROM date_position_requirements WHERE id = ?', [existingReq.id]);
    } else {
      const newId = generateId();
      await runQuery(`
        INSERT INTO date_position_requirements (id, date_id, position_id, required_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [newId, dateId, position_id, required_count || 1, now, now]);
      result = await getOne('SELECT * FROM date_position_requirements WHERE id = ?', [newId]);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/requirements/:reqId', async (req, res) => {
  try {
    const { id: dateId, reqId } = req.params;
    
    const existing = await getOne(`
      SELECT * FROM date_position_requirements 
      WHERE id = ? AND date_id = ?
    `, [reqId, dateId]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    
    await runQuery('DELETE FROM date_position_requirements WHERE id = ?', [reqId]);
    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
