const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const createBatch = (req, res) => {
  const { name, description, created_by } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '批次名称不能为空' });
  }

  const id = uuidv4();
  const sql = 'INSERT INTO batches (id, name, description, created_by) VALUES (?, ?, ?, ?)';
  
  db.run(sql, [id, name, description, created_by || 'system'], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({
      id,
      name,
      description,
      status: 'pending',
      created_by: created_by || 'system',
      created_at: new Date().toISOString()
    });
  });
};

const getBatches = (req, res) => {
  const sql = 'SELECT * FROM batches ORDER BY created_at DESC';
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

const getBatchById = (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM batches WHERE id = ?', [id], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    db.all('SELECT COUNT(*) as count, category FROM details WHERE batch_id = ? GROUP BY category', [id], (err, stats) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const statistics = {
        total: 0,
        normal: 0,
        pending: 0,
        blocked: 0
      };
      
      stats.forEach(s => {
        statistics.total += s.count;
        if (s.category === 'normal') statistics.normal = s.count;
        else if (s.category === 'pending_supplement') statistics.pending = s.count;
        else if (s.category === 'blocked') statistics.blocked = s.count;
      });
      
      res.json({ batch, statistics });
    });
  });
};

module.exports = {
  createBatch,
  getBatches,
  getBatchById
};
