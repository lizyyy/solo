const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { runQuery, getOne, getAll, generateId } = require('../utils/dbHelper');

router.get('/', async (req, res) => {
  try {
    const volunteers = await getAll(`
      SELECT v.*
      FROM volunteers v
      ORDER BY v.name
    `);
    
    for (let volunteer of volunteers) {
      const skills = await getAll(`
        SELECT s.*
        FROM skills s
        JOIN volunteer_skills vs ON s.id = vs.skill_id
        WHERE vs.volunteer_id = ?
      `, [volunteer.id]);
      volunteer.skills = skills;
      
      const availableDates = await getAll(`
        SELECT ed.*
        FROM event_dates ed
        JOIN volunteer_available_dates vad ON ed.id = vad.date_id
        WHERE vad.volunteer_id = ?
        ORDER BY ed.date
      `, [volunteer.id]);
      volunteer.available_dates = availableDates;
    }
    
    res.json(volunteers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await getOne('SELECT * FROM volunteers WHERE id = ?', [id]);
    
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    const skills = await getAll(`
      SELECT s.*
      FROM skills s
      JOIN volunteer_skills vs ON s.id = vs.skill_id
      WHERE vs.volunteer_id = ?
    `, [id]);
    volunteer.skills = skills;
    
    const availableDates = await getAll(`
      SELECT ed.*
      FROM event_dates ed
      JOIN volunteer_available_dates vad ON ed.id = vad.date_id
      WHERE vad.volunteer_id = ?
      ORDER BY ed.date
    `, [id]);
    volunteer.available_dates = availableDates;
    
    const schedules = await getAll(`
      SELECT s.*, ed.date, p.name as position_name
      FROM schedules s
      JOIN event_dates ed ON s.date_id = ed.id
      JOIN positions p ON s.position_id = p.id
      WHERE s.volunteer_id = ?
      ORDER BY ed.date
    `, [id]);
    volunteer.schedules = schedules;
    
    res.json(volunteer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, max_daily_shifts, notes, skills, available_date_ids } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO volunteers (id, name, phone, email, max_daily_shifts, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, phone || '', email || '', max_daily_shifts || 1, notes || '', now, now]);
    
    if (skills && Array.isArray(skills) && skills.length > 0) {
      for (const skillId of skills) {
        try {
          await runQuery(`
            INSERT INTO volunteer_skills (volunteer_id, skill_id)
            VALUES (?, ?)
          `, [id, skillId]);
        } catch (e) {
        }
      }
    }
    
    if (available_date_ids && Array.isArray(available_date_ids) && available_date_ids.length > 0) {
      for (const dateId of available_date_ids) {
        try {
          await runQuery(`
            INSERT INTO volunteer_available_dates (volunteer_id, date_id)
            VALUES (?, ?)
          `, [id, dateId]);
        } catch (e) {
        }
      }
    }
    
    const newVolunteer = await getOne('SELECT * FROM volunteers WHERE id = ?', [id]);
    const newSkills = await getAll(`
      SELECT s.*
      FROM skills s
      JOIN volunteer_skills vs ON s.id = vs.skill_id
      WHERE vs.volunteer_id = ?
    `, [id]);
    newVolunteer.skills = newSkills;
    
    res.status(201).json(newVolunteer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, max_daily_shifts, notes, skills, available_date_ids } = req.body;
    
    const existing = await getOne('SELECT * FROM volunteers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    const now = new Date().toISOString();
    
    await runQuery(`
      UPDATE volunteers 
      SET name = ?, phone = ?, email = ?, max_daily_shifts = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [
      name ?? existing.name,
      phone ?? existing.phone,
      email ?? existing.email,
      max_daily_shifts ?? existing.max_daily_shifts,
      notes ?? existing.notes,
      now,
      id
    ]);
    
    if (skills !== undefined) {
      await runQuery('DELETE FROM volunteer_skills WHERE volunteer_id = ?', [id]);
      if (Array.isArray(skills) && skills.length > 0) {
        for (const skillId of skills) {
          try {
            await runQuery(`
              INSERT INTO volunteer_skills (volunteer_id, skill_id)
              VALUES (?, ?)
            `, [id, skillId]);
          } catch (e) {
          }
        }
      }
    }
    
    if (available_date_ids !== undefined) {
      await runQuery('DELETE FROM volunteer_available_dates WHERE volunteer_id = ?', [id]);
      if (Array.isArray(available_date_ids) && available_date_ids.length > 0) {
        for (const dateId of available_date_ids) {
          try {
            await runQuery(`
              INSERT INTO volunteer_available_dates (volunteer_id, date_id)
              VALUES (?, ?)
            `, [id, dateId]);
          } catch (e) {
          }
        }
      }
    }
    
    const updatedVolunteer = await getOne('SELECT * FROM volunteers WHERE id = ?', [id]);
    const updatedSkills = await getAll(`
      SELECT s.*
      FROM skills s
      JOIN volunteer_skills vs ON s.id = vs.skill_id
      WHERE vs.volunteer_id = ?
    `, [id]);
    updatedVolunteer.skills = updatedSkills;
    
    const availableDates = await getAll(`
      SELECT ed.*
      FROM event_dates ed
      JOIN volunteer_available_dates vad ON ed.id = vad.date_id
      WHERE vad.volunteer_id = ?
      ORDER BY ed.date
    `, [id]);
    updatedVolunteer.available_dates = availableDates;
    
    res.json(updatedVolunteer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getOne('SELECT * FROM volunteers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    await runQuery('DELETE FROM volunteers WHERE id = ?', [id]);
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
