const express = require('express');
const { v4: uuidv4 } = require('uuid');

function getRepairItemsRouter(db) {
  const router = express.Router();

  function query(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  router.get('/', async (req, res) => {
    try {
      const items = await query(`SELECT * FROM repair_items ORDER BY created_at DESC`);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const item = await queryOne('SELECT * FROM repair_items WHERE id = ?', [req.params.id]);
      if (!item) return res.status(404).json({ error: '维修事项不存在' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { name, description, estimated_cost, start_date, end_date } = req.body;
      const id = uuidv4();
      
      await run(`
        INSERT INTO repair_items (id, name, description, estimated_cost, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, name, description, estimated_cost, start_date, end_date]);

      const item = await queryOne('SELECT * FROM repair_items WHERE id = ?', [id]);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const { name, description, estimated_cost, start_date, end_date, status } = req.body;
      const existing = await queryOne('SELECT * FROM repair_items WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: '维修事项不存在' });

      await run(`
        UPDATE repair_items 
        SET name = ?, description = ?, estimated_cost = ?, start_date = ?, end_date = ?, status = ?
        WHERE id = ?
      `, [name, description, estimated_cost, start_date, end_date, status, req.params.id]);

      const updated = await queryOne('SELECT * FROM repair_items WHERE id = ?', [req.params.id]);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const existing = await queryOne('SELECT * FROM repair_items WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: '维修事项不存在' });

      await run('DELETE FROM repair_items WHERE id = ?', [req.params.id]);
      res.json({ message: '删除成功' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { getRepairItemsRouter };
