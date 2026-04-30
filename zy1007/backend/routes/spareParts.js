const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
  const { low_stock } = req.query;
  let sql = `SELECT * FROM spare_parts ORDER BY name`;
  let params = [];

  if (low_stock === 'true') {
    sql = `SELECT * FROM spare_parts WHERE stock <= safe_stock ORDER BY stock ASC`;
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows });
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM spare_parts WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '备件不存在' });
    }
    res.json({ data: row });
  });
});

router.post('/', (req, res) => {
  const { name, model, stock, safe_stock, unit, price } = req.body;

  if (!name) {
    return res.status(400).json({ error: '备件名称不能为空' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(`
    INSERT INTO spare_parts (id, name, model, stock, safe_stock, unit, price, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, model || '', stock || 0, safe_stock || 5, unit || '个', price || 0, now, now], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({
      data: {
        id,
        name,
        model,
        stock: stock || 0,
        safe_stock: safe_stock || 5,
        unit: unit || '个',
        price: price || 0,
        created_at: now
      }
    });
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, model, stock, safe_stock, unit, price } = req.body;

  db.get('SELECT * FROM spare_parts WHERE id = ?', [id], (err, sparePart) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!sparePart) {
      return res.status(404).json({ error: '备件不存在' });
    }

    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (model !== undefined) {
      updates.push('model = ?');
      values.push(model);
    }
    if (stock !== undefined) {
      updates.push('stock = ?');
      values.push(stock);
    }
    if (safe_stock !== undefined) {
      updates.push('safe_stock = ?');
      values.push(safe_stock);
    }
    if (unit !== undefined) {
      updates.push('unit = ?');
      values.push(unit);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.run(`
      UPDATE spare_parts SET ${updates.join(', ')} WHERE id = ?
    `, values, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        data: {
          id,
          updated_at: now
        }
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM spare_parts WHERE id = ?', [id], (err, sparePart) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!sparePart) {
      return res.status(404).json({ error: '备件不存在' });
    }

    db.get(`
      SELECT COUNT(*) as count FROM spare_part_usages WHERE spare_part_id = ?
    `, [id], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (result.count > 0) {
        return res.status(400).json({ error: '该备件已被使用，无法删除' });
      }

      db.run('DELETE FROM spare_parts WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({
          data: {
            id,
            deleted: true
          }
        });
      });
    });
  });
});

module.exports = router;
