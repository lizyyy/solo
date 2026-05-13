const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateId, addTimeline, addModificationHistory, getTimeline, getModificationHistory, idempotentMiddleware } = require('../utils');

router.get('/', (req, res) => {
  const { store_id, status } = req.query;
  let query = `SELECT * FROM inspection_plans WHERE 1=1`;
  const params = [];
  
  if (store_id) {
    query += ` AND store_id = ?`;
    params.push(store_id);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM inspection_plans WHERE id = ?`, [req.params.id], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '巡店计划不存在' });
    } else {
      const problems = await new Promise((resolve) => {
        db.all(`SELECT * FROM problems WHERE inspection_id = ?`, [req.params.id], (err, rows) => {
          resolve(err ? [] : rows);
        });
      });
      const timeline = await getTimeline('inspection', req.params.id);
      const history = await getModificationHistory('inspection', req.params.id);
      res.json({ ...row, problems, timeline, modificationHistory: history });
    }
  });
});

router.post('/', idempotentMiddleware, (req, res) => {
  const { title, store_id, store_name, inspector, inspector_phone, plan_date, description, operator } = req.body;
  const id = generateId();
  
  db.run(
    `INSERT INTO inspection_plans (id, title, store_id, store_name, inspector, inspector_phone, plan_date, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, title, store_id, store_name, inspector, inspector_phone, plan_date, description],
    async (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        await addTimeline('inspection', id, 'create', '创建巡店计划', operator, { title, store_name, plan_date });
        res.status(201).json({ id, title, store_id, store_name, status: 'pending' });
      }
    }
  );
});

router.put('/:id', idempotentMiddleware, (req, res) => {
  const { title, store_id, store_name, inspector, inspector_phone, plan_date, description, operator, reason } = req.body;
  
  db.get(`SELECT * FROM inspection_plans WHERE id = ?`, [req.params.id], async (err, oldPlan) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldPlan) return res.status(404).json({ error: '巡店计划不存在' });
    
    const updates = [];
    const params = [];
    const fields = { title, store_id, store_name, inspector, inspector_phone, plan_date, description };
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== oldPlan[key]) {
        updates.push(`${key} = ?`);
        params.push(value);
        await addModificationHistory('inspection', req.params.id, key, oldPlan[key], value, operator, 'update', reason);
      }
    }
    
    if (updates.length === 0) {
      return res.json({ message: '没有需要更新的内容' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    db.run(
      `UPDATE inspection_plans SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addTimeline('inspection', req.params.id, 'update', '更新巡店计划', operator, { reason });
          res.json({ message: '更新成功' });
        }
      }
    );
  });
});

router.post('/:id/start', idempotentMiddleware, (req, res) => {
  const { operator } = req.body;
  
  db.get(`SELECT * FROM inspection_plans WHERE id = ?`, [req.params.id], async (err, plan) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!plan) return res.status(404).json({ error: '巡店计划不存在' });
    if (plan.status !== 'pending') return res.status(400).json({ error: '计划状态不正确' });
    
    db.run(
      `UPDATE inspection_plans SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addModificationHistory('inspection', req.params.id, 'status', 'pending', 'in_progress', operator, 'status_change', '开始巡店');
          await addTimeline('inspection', req.params.id, 'start', '开始巡店', operator, { oldStatus: 'pending', newStatus: 'in_progress' });
          res.json({ message: '开始巡店成功', status: 'in_progress' });
        }
      }
    );
  });
});

router.post('/:id/complete', idempotentMiddleware, (req, res) => {
  const { operator } = req.body;
  
  db.get(`SELECT * FROM inspection_plans WHERE id = ?`, [req.params.id], async (err, plan) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!plan) return res.status(404).json({ error: '巡店计划不存在' });
    if (plan.status !== 'in_progress') return res.status(400).json({ error: '计划状态不正确' });
    
    db.run(
      `UPDATE inspection_plans SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addModificationHistory('inspection', req.params.id, 'status', 'in_progress', 'completed', operator, 'status_change', '完成巡店');
          await addTimeline('inspection', req.params.id, 'complete', '完成巡店', operator, { oldStatus: 'in_progress', newStatus: 'completed' });
          res.json({ message: '完成巡店成功', status: 'completed' });
        }
      }
    );
  });
});

module.exports = router;
