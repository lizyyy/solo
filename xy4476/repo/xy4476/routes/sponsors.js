const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM sponsors ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM sponsors WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, category, website, contact_person, phone, email } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Name and category are required' });
  }
  
  const stmt = db.prepare('INSERT INTO sponsors (name, category, website, contact_person, phone, email) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(name, category, website, contact_person, phone, email, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, name, category, website, contact_person, phone, email });
  });
  stmt.finalize();
});

router.put('/:id', (req, res) => {
  const { name, category, website, contact_person, phone, email } = req.body;
  const stmt = db.prepare('UPDATE sponsors SET name = ?, category = ?, website = ?, contact_person = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(name, category, website, contact_person, phone, email, req.params.id, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }
    res.json({ id: req.params.id, name, category, website, contact_person, phone, email });
  });
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM sponsors WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }
    res.status(204).end();
  });
});

module.exports = router;
