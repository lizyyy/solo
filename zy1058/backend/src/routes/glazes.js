const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const query = `
    SELECT g.*, COUNT(a.id) as artwork_count
    FROM glazes g
    LEFT JOIN artworks a ON g.id = a.glaze_id OR g.id = a.glaze2_id
    GROUP BY g.id
    ORDER BY g.name
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
    SELECT g.*, COUNT(a.id) as artwork_count
    FROM glazes g
    LEFT JOIN artworks a ON g.id = a.glaze_id OR g.id = a.glaze2_id
    WHERE g.id = ?
    GROUP BY g.id
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '釉料不存在' });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, type, temp_min, temp_max, cone, color, compatible_clays, incompatible_glazes, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '釉料名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO glazes (name, type, temp_min, temp_max, cone, color, compatible_clays, incompatible_glazes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [
    name, type, temp_min, temp_max, cone, color,
    compatible_clays ? JSON.stringify(compatible_clays) : null,
    incompatible_glazes ? JSON.stringify(incompatible_glazes) : null,
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
      temp_min,
      temp_max,
      cone,
      color,
      compatible_clays,
      incompatible_glazes,
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { name, type, temp_min, temp_max, cone, color, compatible_clays, incompatible_glazes, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '釉料名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE glazes 
    SET name = ?, type = ?, temp_min = ?, temp_max = ?, cone = ?, color = ?, 
        compatible_clays = ?, incompatible_glazes = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [
    name, type, temp_min, temp_max, cone, color,
    compatible_clays ? JSON.stringify(compatible_clays) : null,
    incompatible_glazes ? JSON.stringify(incompatible_glazes) : null,
    notes,
    req.params.id
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '釉料不存在' });
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
      compatible_clays,
      incompatible_glazes,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM artworks WHERE glaze_id = ? OR glaze2_id = ?';
  
  db.get(checkQuery, [req.params.id, req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该釉料下有 ${row.count} 个作品，无法删除` });
      return;
    }
    
    const deleteQuery = 'DELETE FROM glazes WHERE id = ?';
    
    db.run(deleteQuery, [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '釉料不存在' });
        return;
      }
      res.json({ message: '删除成功', id: parseInt(req.params.id) });
    });
  });
});

module.exports = router;
