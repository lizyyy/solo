const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { validateCoach } = require('../utils/validators');

router.get('/', (req, res) => {
  db.all(`SELECT * FROM coaches ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      console.error('获取教练列表失败:', err);
      res.status(500).json({ error: '获取教练列表失败' });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM coaches WHERE id = ?`, [id], (err, coach) => {
    if (err) {
      console.error('获取教练信息失败:', err);
      res.status(500).json({ error: '获取教练信息失败' });
      return;
    }
    
    if (!coach) {
      res.status(404).json({ error: '教练不存在' });
      return;
    }
    
    res.json(coach);
  });
});

router.post('/', (req, res) => {
  const errors = validateCoach(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { name, phone } = req.body;
  
  db.run(
    `INSERT INTO coaches (name, phone) VALUES (?, ?)`,
    [name, phone],
    function (err) {
      if (err) {
        console.error('添加教练失败:', err);
        res.status(500).json({ error: '添加教练失败' });
        return;
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        phone
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const errors = validateCoach(req.body);
  
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  
  const { name, phone } = req.body;
  
  db.run(
    `UPDATE coaches SET name = ?, phone = ? WHERE id = ?`,
    [name, phone, id],
    function (err) {
      if (err) {
        console.error('更新教练失败:', err);
        res.status(500).json({ error: '更新教练失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '教练不存在' });
        return;
      }
      
      res.json({
        id,
        name,
        phone
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT COUNT(*) as count FROM schedules WHERE coach_id = ?`, [id], (err, result) => {
    if (err) {
      console.error('检查教练排班记录失败:', err);
      res.status(500).json({ error: '检查教练排班记录失败' });
      return;
    }
    
    if (result.count > 0) {
      res.status(400).json({ error: '该教练有排班记录，无法删除' });
      return;
    }
    
    db.run(`DELETE FROM coaches WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error('删除教练失败:', err);
        res.status(500).json({ error: '删除教练失败' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: '教练不存在' });
        return;
      }
      
      res.json({ message: '教练已删除' });
    });
  });
});

module.exports = router;
