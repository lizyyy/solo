const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有补药任务
router.get('/', (req, res) => {
  const { status } = req.query;
  
  let query = `
    SELECT rt.*, m.name as medicine_name, m.specification, i.unit
    FROM replenish_tasks rt
    LEFT JOIN medicines m ON rt.medicine_id = m.id
    LEFT JOIN inventory i ON rt.medicine_id = i.medicine_id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND rt.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY rt.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取待处理的补药任务
router.get('/pending', (req, res) => {
  const query = `
    SELECT rt.*, m.name as medicine_name, m.specification, i.unit
    FROM replenish_tasks rt
    LEFT JOIN medicines m ON rt.medicine_id = m.id
    LEFT JOIN inventory i ON rt.medicine_id = i.medicine_id
    WHERE rt.status = 'pending'
    ORDER BY rt.created_at ASC
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个补药任务
router.get('/:id', (req, res) => {
  const query = `
    SELECT rt.*, m.name as medicine_name, m.specification, i.unit
    FROM replenish_tasks rt
    LEFT JOIN medicines m ON rt.medicine_id = m.id
    LEFT JOIN inventory i ON rt.medicine_id = i.medicine_id
    WHERE rt.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '补药任务不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建补药任务
router.post('/', (req, res) => {
  const { medicine_id, current_quantity, required_quantity, assigned_to, notes } = req.body;
  const id = uuidv4();
  
  // 检查是否已存在该药品的待处理任务
  db.get(
    `SELECT * FROM replenish_tasks WHERE medicine_id = ? AND status = 'pending'`,
    [medicine_id],
    (err, existingTask) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (existingTask) {
        res.status(400).json({ error: '该药品已有待处理的补药任务' });
        return;
      }
      
      db.run(
        `INSERT INTO replenish_tasks 
         (id, medicine_id, current_quantity, required_quantity, status, assigned_to, notes)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        [id, medicine_id, current_quantity, required_quantity, assigned_to, notes],
        function (err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.status(201).json({ 
            id, 
            medicine_id, 
            current_quantity, 
            required_quantity, 
            status: 'pending', 
            assigned_to, 
            notes 
          });
        }
      );
    }
  );
});

// 根据低库存自动创建补药任务
router.post('/auto-create', (req, res) => {
  // 获取所有低库存药品
  const lowStockQuery = `
    SELECT i.*, m.name as medicine_name
    FROM inventory i
    LEFT JOIN medicines m ON i.medicine_id = m.id
    WHERE i.quantity <= i.threshold
  `;
  
  db.all(lowStockQuery, (err, lowStockItems) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const createdTasks = [];
    let processed = 0;
    
    if (lowStockItems.length === 0) {
      res.json({ message: '没有低库存药品需要补药', tasks: [] });
      return;
    }
    
    lowStockItems.forEach(item => {
      // 检查是否已存在待处理任务
      db.get(
        `SELECT * FROM replenish_tasks WHERE medicine_id = ? AND status = 'pending'`,
        [item.medicine_id],
        (err, existingTask) => {
          if (err) {
            console.error('检查现有任务失败:', err.message);
            processed++;
            if (processed === lowStockItems.length) {
              res.json({ 
                message: `已处理 ${lowStockItems.length} 个低库存药品`,
                tasks: createdTasks 
              });
            }
            return;
          }
          
          if (existingTask) {
            processed++;
            if (processed === lowStockItems.length) {
              res.json({ 
                message: `已处理 ${lowStockItems.length} 个低库存药品`,
                tasks: createdTasks 
              });
            }
            return;
          }
          
          // 创建新任务
          const id = uuidv4();
          const requiredQuantity = item.threshold * 2; // 建议补充到阈值的2倍
          
          db.run(
            `INSERT INTO replenish_tasks 
             (id, medicine_id, current_quantity, required_quantity, status, notes)
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [id, item.medicine_id, item.quantity, requiredQuantity, `库存低至 ${item.quantity}，阈值为 ${item.threshold}`],
            function (err) {
              if (err) {
                console.error('创建补药任务失败:', err.message);
              } else {
                createdTasks.push({
                  id,
                  medicine_id: item.medicine_id,
                  medicine_name: item.medicine_name,
                  current_quantity: item.quantity,
                  required_quantity: requiredQuantity,
                  status: 'pending'
                });
              }
              
              processed++;
              if (processed === lowStockItems.length) {
                res.json({ 
                  message: `已处理 ${lowStockItems.length} 个低库存药品，创建了 ${createdTasks.length} 个新任务`,
                  tasks: createdTasks 
                });
              }
            }
          );
        }
      );
    });
  });
});

// 更新补药任务
router.put('/:id', (req, res) => {
  const { current_quantity, required_quantity, status, assigned_to, notes } = req.body;
  
  db.run(
    `UPDATE replenish_tasks 
     SET current_quantity = ?, required_quantity = ?, status = ?, assigned_to = ?, notes = ?
     WHERE id = ?`,
    [current_quantity, required_quantity, status, assigned_to, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '补药任务不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        current_quantity, 
        required_quantity, 
        status, 
        assigned_to, 
        notes 
      });
    }
  );
});

// 完成补药任务
router.post('/:id/complete', (req, res) => {
  const { volunteer_name, notes } = req.body;
  const now = new Date().toISOString();
  
  // 先获取任务信息
  db.get(
    `SELECT rt.*, i.id as inventory_id 
     FROM replenish_tasks rt
     LEFT JOIN inventory i ON rt.medicine_id = i.medicine_id
     WHERE rt.id = ?`,
    [req.params.id],
    (err, task) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!task) {
        res.status(404).json({ error: '补药任务不存在' });
        return;
      }
      
      // 更新任务状态
      db.run(
        `UPDATE replenish_tasks 
         SET status = 'completed', completed_at = ?, notes = ?
         WHERE id = ?`,
        [now, notes, req.params.id],
        function (err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // 同时更新库存（如果有库存记录）
          if (task.inventory_id) {
            const newQuantity = task.required_quantity;
            db.run(
              `UPDATE inventory 
               SET quantity = ?, last_updated = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [newQuantity, task.inventory_id],
              function (invErr) {
                if (invErr) {
                  console.error('更新库存失败:', invErr.message);
                }
              }
            );
          }
          
          res.json({ 
            id: req.params.id, 
            status: 'completed', 
            completed_at: now,
            notes 
          });
        }
      );
    }
  );
});

// 删除补药任务
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM replenish_tasks WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '补药任务不存在' });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
