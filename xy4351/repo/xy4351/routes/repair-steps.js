const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  db.all(`
    SELECT rs.*, rt.id as task_id
    FROM repair_steps rs
    LEFT JOIN repair_tasks rt ON rs.task_id = rt.id
    ORDER BY rs.task_id, rs.step_order
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT * FROM repair_steps WHERE id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '修复步骤不存在' });
    }
    res.json(row);
  });
});

router.get('/task/:taskId', (req, res) => {
  db.all(`
    SELECT * FROM repair_steps 
    WHERE task_id = ? 
    ORDER BY step_order
  `, [req.params.taskId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { task_id, step_order, step_name, description, required_materials, status } = req.body;
  
  db.get('SELECT id FROM repair_tasks WHERE id = ?', [task_id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!task) {
      return res.status(400).json({ error: '指定的修复任务不存在' });
    }
    
    db.get('SELECT id FROM repair_steps WHERE task_id = ? AND step_order = ?', [task_id, step_order], (err, existingStep) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (existingStep) {
        return res.status(400).json({ error: '该任务中已存在相同顺序的步骤' });
      }
      
      const stmt = db.prepare(`
        INSERT INTO repair_steps (task_id, step_order, step_name, description, required_materials, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        task_id,
        step_order,
        step_name,
        description || null,
        required_materials || null,
        status || '待执行',
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({
            id: this.lastID,
            message: '修复步骤创建成功'
          });
        }
      );
      stmt.finalize();
    });
  });
});

router.put('/:id', (req, res) => {
  const { task_id, step_order, step_name, description, required_materials, status, completed_at, completed_by } = req.body;
  
  const stmt = db.prepare(`
    UPDATE repair_steps 
    SET task_id = ?, step_order = ?, step_name = ?, description = ?, required_materials = ?, 
        status = ?, completed_at = ?, completed_by = ?
    WHERE id = ?
  `);
  
  stmt.run(
    task_id,
    step_order,
    step_name,
    description || null,
    required_materials || null,
    status || '待执行',
    completed_at || null,
    completed_by || null,
    req.params.id,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '修复步骤不存在' });
      }
      res.json({ message: '修复步骤更新成功' });
    }
  );
  stmt.finalize();
});

router.put('/:id/complete', (req, res) => {
  const { completed_by } = req.body;
  
  const stmt = db.prepare(`
    UPDATE repair_steps 
    SET status = '已完成', completed_at = CURRENT_TIMESTAMP, completed_by = ?
    WHERE id = ?
  `);
  
  stmt.run(
    completed_by || '系统',
    req.params.id,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '修复步骤不存在' });
      }
      res.json({ message: '修复步骤已标记为完成' });
    }
  );
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM repair_steps WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '修复步骤不存在' });
    }
    res.json({ message: '修复步骤删除成功' });
  });
});

module.exports = router;
