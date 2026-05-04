const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  db.all(`
    SELECT hc.*, 
           (hc.max_capacity - hc.current_usage) as available_space
    FROM humidity_cabinets hc
    ORDER BY hc.cabinet_number
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT hc.*, 
           (hc.max_capacity - hc.current_usage) as available_space
    FROM humidity_cabinets hc
    WHERE hc.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '恒湿柜不存在' });
    }
    res.json(row);
  });
});

router.get('/cabinet/:cabinetNumber', (req, res) => {
  db.get(`
    SELECT hc.*, 
           (hc.max_capacity - hc.current_usage) as available_space
    FROM humidity_cabinets hc
    WHERE hc.cabinet_number = ?
  `, [req.params.cabinetNumber], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '恒湿柜不存在' });
    }
    res.json(row);
  });
});

router.get('/status/:status', (req, res) => {
  db.all(`
    SELECT hc.*, 
           (hc.max_capacity - hc.current_usage) as available_space
    FROM humidity_cabinets hc
    WHERE hc.status = ?
    ORDER BY hc.cabinet_number
  `, [req.params.status], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { cabinet_number, location, max_capacity, current_usage, status } = req.body;
  
  db.get('SELECT id FROM humidity_cabinets WHERE cabinet_number = ?', [cabinet_number], (err, existingCabinet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (existingCabinet) {
      return res.status(400).json({ error: '恒湿柜编号已存在' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO humidity_cabinets (cabinet_number, location, max_capacity, current_usage, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      cabinet_number,
      location,
      max_capacity,
      current_usage || 0,
      status || '正常',
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
          id: this.lastID,
          message: '恒湿柜创建成功'
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id', (req, res) => {
  const { cabinet_number, location, max_capacity, current_usage, status } = req.body;
  
  const stmt = db.prepare(`
    UPDATE humidity_cabinets 
    SET cabinet_number = ?, location = ?, max_capacity = ?, current_usage = ?, status = ?
    WHERE id = ?
  `);
  
  stmt.run(
    cabinet_number,
    location,
    max_capacity,
    current_usage || 0,
    status || '正常',
    req.params.id,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '恒湿柜不存在' });
      }
      res.json({ message: '恒湿柜更新成功' });
    }
  );
  stmt.finalize();
});

router.put('/:id/occupy', (req, res) => {
  const { books_to_add = 1 } = req.body;
  
  db.get('SELECT * FROM humidity_cabinets WHERE id = ?', [req.params.id], (err, cabinet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!cabinet) {
      return res.status(404).json({ error: '恒湿柜不存在' });
    }
    
    const availableSpace = cabinet.max_capacity - cabinet.current_usage;
    if (availableSpace < books_to_add) {
      return res.status(400).json({ 
        error: '恒湿柜容量不足',
        available_space: availableSpace,
        requested: books_to_add
      });
    }
    
    const newUsage = cabinet.current_usage + books_to_add;
    
    const stmt = db.prepare(`
      UPDATE humidity_cabinets 
      SET current_usage = ?
      WHERE id = ?
    `);
    
    stmt.run(
      newUsage,
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: '书册已放入恒湿柜',
          current_usage: newUsage,
          available_space: cabinet.max_capacity - newUsage
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id/release', (req, res) => {
  const { books_to_remove = 1 } = req.body;
  
  db.get('SELECT * FROM humidity_cabinets WHERE id = ?', [req.params.id], (err, cabinet) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!cabinet) {
      return res.status(404).json({ error: '恒湿柜不存在' });
    }
    
    if (cabinet.current_usage < books_to_remove) {
      return res.status(400).json({ 
        error: '恒湿柜中没有足够的书册',
        current_usage: cabinet.current_usage,
        requested: books_to_remove
      });
    }
    
    const newUsage = Math.max(0, cabinet.current_usage - books_to_remove);
    
    const stmt = db.prepare(`
      UPDATE humidity_cabinets 
      SET current_usage = ?
      WHERE id = ?
    `);
    
    stmt.run(
      newUsage,
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: '书册已从恒湿柜取出',
          current_usage: newUsage,
          available_space: cabinet.max_capacity - newUsage
        });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM humidity_cabinets WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '恒湿柜不存在' });
    }
    res.json({ message: '恒湿柜删除成功' });
  });
});

module.exports = router;
