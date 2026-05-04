const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有药品
router.get('/', (req, res) => {
  db.all('SELECT * FROM medicines ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个药品
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM medicines WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '药品不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建药品
router.post('/', (req, res) => {
  const { name, specification, manufacturer, category, description } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO medicines (id, name, specification, manufacturer, category, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, specification, manufacturer, category, description],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 同时创建库存记录
      const inventoryId = uuidv4();
      db.run(
        `INSERT INTO inventory (id, medicine_id, quantity, threshold, unit)
         VALUES (?, ?, 0, 10, '盒')`,
        [inventoryId, id],
        function (invErr) {
          if (invErr) {
            console.error('创建库存记录失败:', invErr.message);
          }
        }
      );
      
      res.status(201).json({ 
        id, 
        name, 
        specification, 
        manufacturer, 
        category, 
        description 
      });
    }
  );
});

// 更新药品
router.put('/:id', (req, res) => {
  const { name, specification, manufacturer, category, description } = req.body;
  
  db.run(
    `UPDATE medicines 
     SET name = ?, specification = ?, manufacturer = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, specification, manufacturer, category, description, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '药品不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        name, 
        specification, 
        manufacturer, 
        category, 
        description 
      });
    }
  );
});

// 删除药品
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM medicines WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '药品不存在' });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
