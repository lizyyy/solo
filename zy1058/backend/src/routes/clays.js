const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const query = `
    SELECT c.*, COUNT(a.id) as artwork_count
    FROM clays c
    LEFT JOIN artworks a ON c.id = a.clay_id
    GROUP BY c.id
    ORDER BY c.name
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT c.*, COUNT(a.id) as artwork_count
    FROM clays c
    LEFT JOIN artworks a ON c.id = a.clay_id
    WHERE c.id = ?
    GROUP BY c.id
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '泥料不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, type, temp_min, temp_max, cone, color, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '泥料名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO clays (name, type, temp_min, temp_max, cone, color, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [name, type, temp_min, temp_max, cone, color, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      id: this.lastID,
      name,
      type,
      temp_min,
      temp_max,
      cone,
      color,
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { name, type, temp_min, temp_max, cone, color, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '泥料名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE clays 
    SET name = ?, type = ?, temp_min = ?, temp_max = ?, cone = ?, color = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [name, type, temp_min, temp_max, cone, color, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '泥料不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      name,
      type,
      temp_min,
      temp_max,
      cone,
      color,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM artworks WHERE clay_id = ?';
  
  db.get(checkQuery, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该泥料下有 ${row.count} 个作品，无法删除` });
      return;
    }
    
    const deleteQuery = 'DELETE FROM clays WHERE id = ?';
    
    db.run(deleteQuery, [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '泥料不存在' });
        return;
      }
      res.json({ message: '删除成功', id: parseInt(req.params.id) });
    });
  });
});

module.exports = router;
