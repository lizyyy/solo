const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  db.all(`
    SELECT da.*, b.title as book_title 
    FROM damage_assessments da
    LEFT JOIN books b ON da.book_id = b.id
    ORDER BY da.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT da.*, b.title as book_title 
    FROM damage_assessments da
    LEFT JOIN books b ON da.book_id = b.id
    WHERE da.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '破损评估不存在' });
    }
    res.json(row);
  });
});

router.get('/book/:bookId', (req, res) => {
  db.all(`
    SELECT * FROM damage_assessments 
    WHERE book_id = ? 
    ORDER BY assessment_date DESC
  `, [req.params.bookId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { book_id, assessor, damage_type, severity, description, assessment_date } = req.body;
  
  db.get('SELECT id FROM books WHERE id = ?', [book_id], (err, book) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!book) {
      return res.status(400).json({ error: '指定的书册不存在' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO damage_assessments (book_id, assessor, damage_type, severity, description, assessment_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      book_id,
      assessor,
      damage_type,
      severity,
      description || null,
      assessment_date || new Date().toISOString().split('T')[0],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
          id: this.lastID,
          message: '破损评估创建成功'
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id', (req, res) => {
  const { book_id, assessor, damage_type, severity, description, assessment_date } = req.body;
  
  db.get('SELECT id FROM books WHERE id = ?', [book_id], (err, book) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!book) {
      return res.status(400).json({ error: '指定的书册不存在' });
    }
    
    const stmt = db.prepare(`
      UPDATE damage_assessments 
      SET book_id = ?, assessor = ?, damage_type = ?, severity = ?, description = ?, assessment_date = ?
      WHERE id = ?
    `);
    
    stmt.run(
      book_id,
      assessor,
      damage_type,
      severity,
      description || null,
      assessment_date,
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '破损评估不存在' });
        }
        res.json({ message: '破损评估更新成功' });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM damage_assessments WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '破损评估不存在' });
    }
    res.json({ message: '破损评估删除成功' });
  });
});

module.exports = router;
