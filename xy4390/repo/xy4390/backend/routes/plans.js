const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有服药计划
router.get('/', (req, res) => {
  const query = `
    SELECT mp.*, e.name as elderly_name, m.name as medicine_name
    FROM medication_plans mp
    LEFT JOIN elderly e ON mp.elderly_id = e.id
    LEFT JOIN medicines m ON mp.medicine_id = m.id
    ORDER BY mp.created_at DESC
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取今日服药清单
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const query = `
    SELECT mp.*, e.name as elderly_name, e.room, m.name as medicine_name
    FROM medication_plans mp
    LEFT JOIN elderly e ON mp.elderly_id = e.id
    LEFT JOIN medicines m ON mp.medicine_id = m.id
    WHERE mp.status = 'active'
    ORDER BY mp.time ASC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 检查每个计划是否今天需要服药
    const todayPlans = rows.filter(plan => {
      // 检查日期范围
      if (plan.start_date && today < plan.start_date) return false;
      if (plan.end_date && today > plan.end_date) return false;
      
      // 检查频率
      const dayOfWeek = new Date(today).getDay();
      switch (plan.frequency) {
        case '每天':
          return true;
        case '工作日':
          return dayOfWeek >= 1 && dayOfWeek <= 5;
        case '周末':
          return dayOfWeek === 0 || dayOfWeek === 6;
        default:
          return true;
      }
    });
    
    res.json(todayPlans);
  });
});

// 获取单个服药计划
router.get('/:id', (req, res) => {
  const query = `
    SELECT mp.*, e.name as elderly_name, m.name as medicine_name
    FROM medication_plans mp
    LEFT JOIN elderly e ON mp.elderly_id = e.id
    LEFT JOIN medicines m ON mp.medicine_id = m.id
    WHERE mp.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '服药计划不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建服药计划
router.post('/', (req, res) => {
  const { 
    elderly_id, 
    medicine_id, 
    dosage, 
    time, 
    frequency, 
    start_date, 
    end_date, 
    notes 
  } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO medication_plans 
     (id, elderly_id, medicine_id, dosage, time, frequency, start_date, end_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [id, elderly_id, medicine_id, dosage, time, frequency || '每天', start_date, end_date, notes],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id, 
        elderly_id, 
        medicine_id, 
        dosage, 
        time, 
        frequency: frequency || '每天', 
        start_date, 
        end_date, 
        status: 'active', 
        notes 
      });
    }
  );
});

// 更新服药计划
router.put('/:id', (req, res) => {
  const { 
    elderly_id, 
    medicine_id, 
    dosage, 
    time, 
    frequency, 
    start_date, 
    end_date, 
    status,
    notes 
  } = req.body;
  
  db.run(
    `UPDATE medication_plans 
     SET elderly_id = ?, medicine_id = ?, dosage = ?, time = ?, frequency = ?, 
         start_date = ?, end_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [elderly_id, medicine_id, dosage, time, frequency, start_date, end_date, status, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '服药计划不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        elderly_id, 
        medicine_id, 
        dosage, 
        time, 
        frequency, 
        start_date, 
        end_date, 
        status, 
        notes 
      });
    }
  );
});

// 删除服药计划
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM medication_plans WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '服药计划不存在' });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
