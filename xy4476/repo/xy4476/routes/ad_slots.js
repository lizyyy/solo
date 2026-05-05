const express = require('express');
const router = express.Router();
const db = require('../database');
const conflictChecker = require('../services/conflictChecker');

router.get('/', (req, res) => {
  const query = `
    SELECT a.*, s.name as sponsor_name, e.episode_number, e.title as episode_title
    FROM ad_slots a
    JOIN sponsors s ON a.sponsor_id = s.id
    JOIN episodes e ON a.episode_id = e.id
    ORDER BY e.episode_number DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT a.*, s.name as sponsor_name, e.episode_number, e.title as episode_title
    FROM ad_slots a
    JOIN sponsors s ON a.sponsor_id = s.id
    JOIN episodes e ON a.episode_id = e.id
    WHERE a.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Ad slot not found' });
    }
    res.json(row);
  });
});

router.post('/', async (req, res) => {
  const { sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast, is_fulfilled } = req.body;
  
  if (!sponsor_id || !episode_id || !slot_type) {
    return res.status(400).json({ error: 'Sponsor_id, episode_id and slot_type are required' });
  }
  
  try {
    const sponsor = await new Promise((resolve, reject) => {
      db.get('SELECT category FROM sponsors WHERE id = ?', [sponsor_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!sponsor) {
      return res.status(400).json({ error: 'Sponsor not found' });
    }
    
    const conflicts = await conflictChecker.checkAllConflicts({
      sponsor_id,
      category: sponsor.category,
      episode_ids: [episode_id],
      max_frequency: 2
    });
    
    if (conflicts.hasConflicts) {
      return res.status(409).json({
        error: 'Conflicts detected',
        conflicts: conflicts.conflicts
      });
    }
    
    const stmt = db.prepare('INSERT INTO ad_slots (sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast, is_fulfilled) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast || 0, is_fulfilled || 0, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ 
        id: this.lastID, 
        sponsor_id, 
        episode_id, 
        slot_type, 
        position, 
        contract_id, 
        is_broadcast: is_broadcast || 0, 
        is_fulfilled: is_fulfilled || 0 
      });
    });
    stmt.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast, is_fulfilled } = req.body;
  const stmt = db.prepare('UPDATE ad_slots SET sponsor_id = ?, episode_id = ?, slot_type = ?, position = ?, contract_id = ?, is_broadcast = ?, is_fulfilled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast, is_fulfilled, req.params.id, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ad slot not found' });
    }
    res.json({ id: req.params.id, sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast, is_fulfilled });
  });
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM ad_slots WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ad slot not found' });
    }
    res.status(204).end();
  });
});

module.exports = router;
