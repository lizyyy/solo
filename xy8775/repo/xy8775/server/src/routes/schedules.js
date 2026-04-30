const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll, generateId } = require('../utils/dbHelper');

router.get('/', async (req, res) => {
  try {
    const { date_id, position_id, volunteer_id } = req.query;
    
    let query = `
      SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name
      FROM schedules s
      JOIN event_dates ed ON s.date_id = ed.id
      JOIN positions p ON s.position_id = p.id
      JOIN volunteers v ON s.volunteer_id = v.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (date_id) {
      conditions.push('s.date_id = ?');
      params.push(date_id);
    }
    
    if (position_id) {
      conditions.push('s.position_id = ?');
      params.push(position_id);
    }
    
    if (volunteer_id) {
      conditions.push('s.volunteer_id = ?');
      params.push(volunteer_id);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY ed.date, p.name';
    
    const schedules = await getAll(query, params);
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await getOne(`
      SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name
      FROM schedules s
      JOIN event_dates ed ON s.date_id = ed.id
      JOIN positions p ON s.position_id = p.id
      JOIN volunteers v ON s.volunteer_id = v.id
      WHERE s.id = ?
    `, [id]);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date_id, position_id, volunteer_id, is_draft } = req.body;
    
    if (!date_id || !position_id || !volunteer_id) {
      return res.status(400).json({ error: 'date_id, position_id, and volunteer_id are required' });
    }
    
    const existing = await getOne(`
      SELECT * FROM schedules 
      WHERE date_id = ? AND position_id = ? AND volunteer_id = ?
    `, [date_id, position_id, volunteer_id]);
    
    if (existing) {
      return res.status(400).json({ error: 'Schedule already exists for this volunteer, date, and position' });
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO schedules (id, date_id, position_id, volunteer_id, is_draft, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, date_id, position_id, volunteer_id, is_draft !== false ? 1 : 0, now, now]);
    
    const newSchedule = await getOne(`
      SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name
      FROM schedules s
      JOIN event_dates ed ON s.date_id = ed.id
      JOIN positions p ON s.position_id = p.id
      JOIN volunteers v ON s.volunteer_id = v.id
      WHERE s.id = ?
    `, [id]);
    
    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_draft } = req.body;
    
    const existing = await getOne('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    const now = new Date().toISOString();
    
    await runQuery(`
      UPDATE schedules 
      SET is_draft = ?, updated_at = ?
      WHERE id = ?
    `, [is_draft !== undefined ? (is_draft ? 1 : 0) : existing.is_draft, now, id]);
    
    const updatedSchedule = await getOne(`
      SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name
      FROM schedules s
      JOIN event_dates ed ON s.date_id = ed.id
      JOIN positions p ON s.position_id = p.id
      JOIN volunteers v ON s.volunteer_id = v.id
      WHERE s.id = ?
    `, [id]);
    
    res.json(updatedSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getOne('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    await runQuery('DELETE FROM schedules WHERE id = ?', [id]);
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { schedules } = req.body;
    
    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({ error: 'schedules array is required' });
    }
    
    const now = new Date().toISOString();
    const createdSchedules = [];
    
    for (const schedule of schedules) {
      const { date_id, position_id, volunteer_id, is_draft } = schedule;
      
      if (!date_id || !position_id || !volunteer_id) {
        continue;
      }
      
      const existing = await getOne(`
        SELECT * FROM schedules 
        WHERE date_id = ? AND position_id = ? AND volunteer_id = ?
      `, [date_id, position_id, volunteer_id]);
      
      if (!existing) {
        const id = generateId();
        await runQuery(`
          INSERT INTO schedules (id, date_id, position_id, volunteer_id, is_draft, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, date_id, position_id, volunteer_id, is_draft !== false ? 1 : 0, now, now]);
        
        const newSchedule = await getOne(`
          SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name
          FROM schedules s
          JOIN event_dates ed ON s.date_id = ed.id
          JOIN positions p ON s.position_id = p.id
          JOIN volunteers v ON s.volunteer_id = v.id
          WHERE s.id = ?
        `, [id]);
        createdSchedules.push(newSchedule);
      } else {
        createdSchedules.push(existing);
      }
    }
    
    res.json({ 
      message: `${createdSchedules.length} schedules created/verified`,
      schedules: createdSchedules 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    await runQuery('DELETE FROM schedules');
    res.json({ message: 'All schedules deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
