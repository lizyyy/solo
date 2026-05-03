const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const query = `
    SELECT fc.*, COUNT(ft.id) as task_count
    FROM firing_curves fc
    LEFT JOIN firing_tasks ft ON fc.id = ft.firing_curve_id
    GROUP BY fc.id
    ORDER BY fc.type, fc.max_temperature
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const curves = rows.map(row => ({
      ...row,
      description: row.description ? JSON.parse(row.description) : null
    }));
    
    res.json(curves);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT fc.*, COUNT(ft.id) as task_count
    FROM firing_curves fc
    LEFT JOIN firing_tasks ft ON fc.id = ft.firing_curve_id
    WHERE fc.id = ?
    GROUP BY fc.id
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '烧成曲线不存在' });
      return;
    }
    
    res.json({
      ...row,
      description: row.description ? JSON.parse(row.description) : null
    });
  });
});

router.post('/', (req, res) => {
  const { name, type, cone, max_temperature, description, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '曲线名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO firing_curves (name, type, cone, max_temperature, description, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [
    name, 
    type || '釉烧', 
    cone, 
    max_temperature,
    description ? JSON.stringify(description) : null,
    notes
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      id: this.lastID,
      name,
      type,
      cone,
      max_temperature,
      description,
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { name, type, cone, max_temperature, description, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '曲线名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE firing_curves 
    SET name = ?, type = ?, cone = ?, max_temperature = ?, description = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [
    name, 
    type, 
    cone, 
    max_temperature,
    description ? JSON.stringify(description) : null,
    notes,
    req.params.id
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '烧成曲线不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      name,
      type,
      cone,
      max_temperature,
      description,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM firing_tasks WHERE firing_curve_id = ?';
  
  db.get(checkQuery, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该曲线已被 ${row.count} 个烧窑任务使用，无法删除` });
      return;
    }
    
    const deleteQuery = 'DELETE FROM firing_curves WHERE id = ?';
    
    db.run(deleteQuery, [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '烧成曲线不存在' });
        return;
      }
      res.json({ message: '删除成功', id: parseInt(req.params.id) });
    });
  });
});

module.exports = router;
