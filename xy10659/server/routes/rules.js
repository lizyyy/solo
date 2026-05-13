const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  const offset = (page - 1) * pageSize;
  
  db.get('SELECT COUNT(*) as total FROM supplement_rules', (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all('SELECT * FROM supplement_rules ORDER BY created_at DESC LIMIT ? OFFSET ?', [parseInt(pageSize), offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: rows, total: countResult.total });
    });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM supplement_rules WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { rule_name, item_id, condition_type, condition_value, supplement_amount, description } = req.body;
  
  db.run(
    'INSERT INTO supplement_rules (rule_name, item_id, condition_type, condition_value, supplement_amount, description) VALUES (?, ?, ?, ?, ?, ?)',
    [rule_name, item_id, condition_type, condition_value, supplement_amount, description],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.put('/:id', (req, res) => {
  const { rule_name, item_id, condition_type, condition_value, supplement_amount, description } = req.body;
  
  db.run(
    'UPDATE supplement_rules SET rule_name = ?, item_id = ?, condition_type = ?, condition_value = ?, supplement_amount = ?, description = ? WHERE id = ?',
    [rule_name, item_id, condition_type, condition_value, supplement_amount, description, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ updated: this.changes });
    }
  );
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM supplement_rules WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
