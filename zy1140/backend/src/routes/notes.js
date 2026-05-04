const express = require('express');
const _ = require('lodash');

const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { startDate, endDate, tags } = req.query;

  try {
    let query = `SELECT * FROM daily_notes WHERE 1=1`;
    const params = [];

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY date DESC`;

    const notes = db.all(query, params);

    const allTags = new Set();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.split(',').filter(Boolean).forEach(tag => allTags.add(tag.trim()));
      }
    });

    res.json({
      notes: notes.map(n => ({
        ...n,
        tagsArray: n.tags ? n.tags.split(',').filter(Boolean).map(t => t.trim()) : [],
      })),
      allTags: Array.from(allTags).sort(),
      total: notes.length,
    });

  } catch (error) {
    console.error('Error getting notes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:date', async (req, res) => {
  const { date } = req.params;

  try {
    const note = db.get(`SELECT * FROM daily_notes WHERE date = ?`, [date]);

    if (!note) {
      return res.json({
        date,
        note: null,
        tagsArray: [],
        exists: false,
      });
    }

    res.json({
      ...note,
      tagsArray: note.tags ? note.tags.split(',').filter(Boolean).map(t => t.trim()) : [],
      exists: true,
    });

  } catch (error) {
    console.error('Error getting note:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:date', async (req, res) => {
  const { date } = req.params;
  const { note, tags, source = 'user' } = req.body;

  try {
    const existing = db.get(`SELECT id FROM daily_notes WHERE date = ?`, [date]);
    const now = new Date().toISOString();

    let tagString = '';
    if (Array.isArray(tags)) {
      tagString = tags.filter(Boolean).join(',');
    } else if (typeof tags === 'string') {
      tagString = tags;
    }

    if (existing) {
      const existingNote = db.get(`SELECT tags FROM daily_notes WHERE date = ?`, [date]);
      let finalTags = tagString;
      
      if (!tagString && existingNote?.tags) {
        finalTags = existingNote.tags;
      }

      db.run(`
        UPDATE daily_notes 
        SET tags = ?, note = ?, source = ?, updated_at = ?
        WHERE date = ?
      `, [finalTags, note || existingNote?.note || '', source, now, date]);
    } else {
      const id = `note_${date}_${Date.now()}`;
      db.run(`
        INSERT INTO daily_notes (id, date, tags, note, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, date, tagString, note || '', source, now, now]);
    }

    const updatedNote = db.get(`SELECT * FROM daily_notes WHERE date = ?`, [date]);
    
    res.json({
      success: true,
      note: {
        ...updatedNote,
        tagsArray: updatedNote.tags ? updatedNote.tags.split(',').filter(Boolean).map(t => t.trim()) : [],
      },
    });

  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:date/tags', async (req, res) => {
  const { date } = req.params;
  const { tags, action = 'add' } = req.body;

  try {
    const existing = db.get(`SELECT * FROM daily_notes WHERE date = ?`, [date]);
    const now = new Date().toISOString();

    if (!existing && action !== 'add') {
      return res.status(404).json({ error: '未找到该日期的备注' });
    }

    let currentTags = existing?.tags ? existing.tags.split(',').filter(Boolean) : [];
    let newTags = Array.isArray(tags) ? tags : [tags].filter(Boolean);

    let finalTags;
    if (action === 'add') {
      finalTags = [...new Set([...currentTags, ...newTags])];
    } else if (action === 'remove') {
      finalTags = currentTags.filter(t => !newTags.includes(t));
    } else if (action === 'replace') {
      finalTags = newTags;
    } else {
      finalTags = currentTags;
    }

    const tagString = finalTags.filter(Boolean).join(',');

    if (existing) {
      db.run(`
        UPDATE daily_notes 
        SET tags = ?, updated_at = ?
        WHERE date = ?
      `, [tagString, now, date]);
    } else {
      const id = `note_${date}_${Date.now()}`;
      db.run(`
        INSERT INTO daily_notes (id, date, tags, note, source, created_at, updated_at)
        VALUES (?, ?, ?, '', 'user', ?, ?)
      `, [id, date, tagString, now, now]);
    }

    const updatedNote = db.get(`SELECT * FROM daily_notes WHERE date = ?`, [date]);
    
    res.json({
      success: true,
      note: {
        ...updatedNote,
        tagsArray: finalTags,
      },
      action,
    });

  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:date', async (req, res) => {
  const { date } = req.params;

  try {
    const existing = db.get(`SELECT id FROM daily_notes WHERE date = ?`, [date]);

    if (!existing) {
      return res.status(404).json({ error: '未找到该日期的备注' });
    }

    db.run(`DELETE FROM daily_notes WHERE date = ?`, [date]);

    res.json({
      success: true,
      message: `已删除 ${date} 的备注`,
      date,
    });

  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/tags/stats', async (req, res) => {
  try {
    const notes = db.all(`SELECT tags, date FROM daily_notes`);
    
    const tagStats = {};
    const tagDates = {};

    for (const note of notes) {
      if (!note.tags) continue;
      
      const tags = note.tags.split(',').filter(Boolean).map(t => t.trim());
      
      for (const tag of tags) {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
        if (!tagDates[tag]) tagDates[tag] = [];
        tagDates[tag].push(note.date);
      }
    }

    const sortedTags = Object.entries(tagStats)
      .map(([tag, count]) => ({
        tag,
        count,
        dates: tagDates[tag].sort(),
        firstDate: tagDates[tag].sort()[0],
        lastDate: tagDates[tag].sort().pop(),
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      tags: sortedTags,
      totalUniqueTags: sortedTags.length,
      totalTaggedDays: notes.filter(n => n.tags).length,
    });

  } catch (error) {
    console.error('Error getting tag stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
