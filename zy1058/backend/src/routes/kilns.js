const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const query = `
    SELECT k.*, 
      COUNT(DISTINCT s.id) as shelf_count,
      COUNT(DISTINCT ft.id) as task_count
    FROM kilns k
    LEFT JOIN shelves s ON k.id = s.kiln_id
    LEFT JOIN firing_tasks ft ON k.id = ft.kiln_id
    GROUP BY k.id
    ORDER BY k.name
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
    SELECT k.*, 
      COUNT(DISTINCT s.id) as shelf_count,
      COUNT(DISTINCT ft.id) as task_count
    FROM kilns k
    LEFT JOIN shelves s ON k.id = s.kiln_id
    LEFT JOIN firing_tasks ft ON k.id = ft.kiln_id
    WHERE k.id = ?
    GROUP BY k.id
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '窑炉不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, type, max_temperature, width, height, depth, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '窑炉名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO kilns (name, type, max_temperature, width, height, depth, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [name, type, max_temperature, width, height, depth, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      id: this.lastID,
      name,
      type,
      max_temperature,
      width,
      height,
      depth,
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { name, type, max_temperature, width, height, depth, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '窑炉名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE kilns 
    SET name = ?, type = ?, max_temperature = ?, width = ?, height = ?, depth = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [name, type, max_temperature, width, height, depth, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '窑炉不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      name,
      type,
      max_temperature,
      width,
      height,
      depth,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM firing_tasks WHERE kiln_id = ?';
  
  db.get(checkQuery, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该窑炉下有 ${row.count} 个烧窑任务，无法删除` });
      return;
    }
    
    db.serialize(() => {
      db.run('DELETE FROM shelves WHERE kiln_id = ?', [req.params.id]);
      
      const deleteQuery = 'DELETE FROM kilns WHERE id = ?';
      db.run(deleteQuery, [req.params.id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: '窑炉不存在' });
          return;
        }
        res.json({ message: '删除成功', id: parseInt(req.params.id) });
      });
    });
  });
});

router.get('/:id/shelves', (req, res) => {
  const query = `
    SELECT * FROM shelves 
    WHERE kiln_id = ? 
    ORDER BY level
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
