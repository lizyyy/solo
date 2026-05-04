const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM books ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM books WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '书册不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { title, author, era, rarity_level, description, status } = req.body;
  const stmt = db.prepare(`
    INSERT INTO books (title, author, era, rarity_level, description, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    title,
    author || null,
    era || null,
    rarity_level || '普通',
    description || null,
    status || '待修复',
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '书册创建成功'
      });
    }
  );
  stmt.finalize();
});

router.put('/:id', (req, res) => {
  const { title, author, era, rarity_level, description, status } = req.body;
  const stmt = db.prepare(`
    UPDATE books 
    SET title = ?, author = ?, era = ?, rarity_level = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(
    title,
    author || null,
    era || null,
    rarity_level || '普通',
    description || null,
    status || '待修复',
    req.params.id,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '书册不存在' });
      }
      res.json({ message: '书册更新成功' });
    }
  );
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM books WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '书册不存在' });
    }
    res.json({ message: '书册删除成功' });
  });
});

module.exports = router;
