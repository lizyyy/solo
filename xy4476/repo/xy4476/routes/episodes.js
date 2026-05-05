const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM episodes ORDER BY episode_number DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM episodes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { episode_number, title, description, publish_date, recording_date, status, inventory } = req.body;
  if (!episode_number || !title) {
    return res.status(400).json({ error: 'Episode number and title are required' });
  }
  
  const stmt = db.prepare('INSERT INTO episodes (episode_number, title, description, publish_date, recording_date, status, inventory) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(episode_number, title, description, publish_date, recording_date, status || 'planned', inventory || 3, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, episode_number, title, description, publish_date, recording_date, status: status || 'planned', inventory: inventory || 3 });
  });
  stmt.finalize();
});

router.put('/:id', (req, res) => {
  const { episode_number, title, description, publish_date, recording_date, status, inventory } = req.body;
  const stmt = db.prepare('UPDATE episodes SET episode_number = ?, title = ?, description = ?, publish_date = ?, recording_date = ?, status = ?, inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(episode_number, title, description, publish_date, recording_date, status, inventory, req.params.id, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    res.json({ id: req.params.id, episode_number, title, description, publish_date, recording_date, status, inventory });
  });
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM episodes WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    res.status(204).end();
  });
});

module.exports = router;
