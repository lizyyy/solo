const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateId, addTimeline, addModificationHistory, getTimeline, getModificationHistory, idempotentMiddleware } = require('../utils');

router.get('/', (req, res) => {
  db.all(`SELECT * FROM stores ORDER BY total_score DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/ranking', (req, res) => {
  db.all(`SELECT * FROM stores ORDER BY total_score DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const ranking = rows.map((store, index) => ({
        ...store,
        rank: index + 1
      }));
      res.json(ranking);
    }
  });
});

router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM stores WHERE id = ?`, [req.params.id], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '门店不存在' });
    } else {
      const timeline = await getTimeline('store', req.params.id);
      const history = await getModificationHistory('store', req.params.id);
      res.json({ ...row, timeline, modificationHistory: history });
    }
  });
});

router.post('/', idempotentMiddleware, (req, res) => {
  const { name, address, manager, manager_phone, operator } = req.body;
  const id = generateId();
  
  db.run(
    `INSERT INTO stores (id, name, address, manager, manager_phone) VALUES (?, ?, ?, ?, ?)`,
    [id, name, address, manager, manager_phone],
    async (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        await addTimeline('store', id, 'create', '创建门店', operator, { name, address, manager });
        res.status(201).json({ id, name, address, manager, manager_phone, total_score: 100 });
      }
    }
  );
});

router.put('/:id', idempotentMiddleware, (req, res) => {
  const { name, address, manager, manager_phone, operator, reason } = req.body;
  
  db.get(`SELECT * FROM stores WHERE id = ?`, [req.params.id], async (err, oldStore) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!oldStore) {
      return res.status(404).json({ error: '门店不存在' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined && name !== oldStore.name) {
      updates.push('name = ?');
      params.push(name);
      await addModificationHistory('store', req.params.id, 'name', oldStore.name, name, operator, 'update', reason);
    }
    if (address !== undefined && address !== oldStore.address) {
      updates.push('address = ?');
      params.push(address);
      await addModificationHistory('store', req.params.id, 'address', oldStore.address, address, operator, 'update', reason);
    }
    if (manager !== undefined && manager !== oldStore.manager) {
      updates.push('manager = ?');
      params.push(manager);
      await addModificationHistory('store', req.params.id, 'manager', oldStore.manager, manager, operator, 'update', reason);
    }
    if (manager_phone !== undefined && manager_phone !== oldStore.manager_phone) {
      updates.push('manager_phone = ?');
      params.push(manager_phone);
      await addModificationHistory('store', req.params.id, 'manager_phone', oldStore.manager_phone, manager_phone, operator, 'update', reason);
    }
    
    if (updates.length === 0) {
      return res.json({ message: '没有需要更新的内容' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    db.run(
      `UPDATE stores SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addTimeline('store', req.params.id, 'update', '更新门店信息', operator, { reason });
          res.json({ message: '更新成功' });
        }
      }
    );
  });
});

router.post('/:id/deduct-points', idempotentMiddleware, (req, res) => {
  const { points, reason, handler } = req.body;
  
  db.get(`SELECT * FROM stores WHERE id = ?`, [req.params.id], async (err, store) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!store) {
      return res.status(404).json({ error: '门店不存在' });
    }
    
    const oldScore = store.total_score;
    const newScore = Math.max(0, oldScore - points);
    
    db.run(
      `UPDATE stores SET total_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newScore, req.params.id],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          await addModificationHistory('store', req.params.id, 'total_score', oldScore, newScore, handler, 'deduct', reason);
          await addTimeline('store', req.params.id, 'deduct_points', `扣除${points}分`, handler, { reason, oldScore, newScore });
          res.json({ message: '扣分成功', oldScore, newScore });
        }
      }
    );
  });
});

module.exports = router;
