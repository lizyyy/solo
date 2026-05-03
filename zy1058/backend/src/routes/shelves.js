const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { kiln_id } = req.query;
  
  let query = `
    SELECT s.*, k.name as kiln_name
    FROM shelves s
    LEFT JOIN kilns k ON s.kiln_id = k.id
  `;
  
  const params = [];
  
  if (kiln_id) {
    query += ' WHERE s.kiln_id = ?';
    params.push(parseInt(kiln_id));
  }
  
  query += ' ORDER BY s.kiln_id, s.level';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT s.*, k.name as kiln_name
    FROM shelves s
    LEFT JOIN kilns k ON s.kiln_id = k.id
    WHERE s.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '层架不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { kiln_id, name, level, width, height, depth, max_weight, notes } = req.body;
  
  if (!kiln_id || !name) {
    res.status(400).json({ error: '窑炉ID和层架名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO shelves (kiln_id, name, level, width, height, depth, max_weight, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [kiln_id, name, level, width, height, depth, max_weight, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      id: this.lastID,
      kiln_id,
      name,
      level,
      width,
      height,
      depth,
      max_weight,
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { kiln_id, name, level, width, height, depth, max_weight, notes } = req.body;
  
  if (!kiln_id || !name) {
    res.status(400).json({ error: '窑炉ID和层架名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE shelves 
    SET kiln_id = ?, name = ?, level = ?, width = ?, height = ?, depth = ?, max_weight = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [kiln_id, name, level, width, height, depth, max_weight, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '层架不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      kiln_id,
      name,
      level,
      width,
      height,
      depth,
      max_weight,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM task_artworks WHERE shelf_id = ?';
  
  db.get(checkQuery, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该层架已被 ${row.count} 个作品使用，无法删除` });
      return;
    }
    
    const deleteQuery = 'DELETE FROM shelves WHERE id = ?';
    
    db.run(deleteQuery, [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '层架不存在' });
        return;
      }
      res.json({ message: '删除成功', id: parseInt(req.params.id) });
    });
  });
});

module.exports = router;
