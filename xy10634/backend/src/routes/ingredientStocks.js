const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Database } = require('../utils/db');

router.get('/', async (req, res) => {
  try {
    const stocks = await Database.all('SELECT * FROM ingredient_stocks ORDER BY created_at DESC');
    res.json({ success: true, data: stocks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const stock = await Database.get('SELECT * FROM ingredient_stocks WHERE id = ?', req.params.id);
    if (!stock) {
      return res.status(404).json({ success: false, message: '原料不存在' });
    }
    const versions = await Database.all('SELECT * FROM ingredient_stock_versions WHERE stock_id = ? ORDER BY version DESC', req.params.id);
    res.json({ success: true, data: { ...stock, versions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { ingredient_name, current_quantity, unit, min_threshold, operator } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    await Database.run(
      'INSERT INTO ingredient_stocks (id, ingredient_name, current_quantity, unit, min_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, ingredient_name, current_quantity, unit, min_threshold, now, now
    );

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, new_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'create', 'ingredient_stock', id, JSON.stringify({ ingredient_name, current_quantity, unit, min_threshold }), operator, now
    );

    res.json({ success: true, data: { id, ingredient_name, current_quantity, unit, min_threshold } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { ingredient_name, current_quantity, unit, min_threshold, operator } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();

    const oldStock = await Database.get('SELECT * FROM ingredient_stocks WHERE id = ?', id);
    if (!oldStock) {
      return res.status(404).json({ success: false, message: '原料不存在' });
    }

    const versionRow = await Database.get('SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM ingredient_stock_versions WHERE stock_id = ?', id);
    const version = versionRow.next_version;

    await Database.run(
      'INSERT INTO ingredient_stock_versions (id, stock_id, ingredient_name, current_quantity, unit, min_threshold, version, modified_by, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), id, oldStock.ingredient_name, oldStock.current_quantity, oldStock.unit, oldStock.min_threshold, version, operator, now
    );

    await Database.run(
      'UPDATE ingredient_stocks SET ingredient_name = ?, current_quantity = ?, unit = ?, min_threshold = ?, updated_at = ? WHERE id = ?',
      ingredient_name, current_quantity, unit, min_threshold, now, id
    );

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, old_value, new_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'update', 'ingredient_stock', id, JSON.stringify(oldStock), JSON.stringify({ ingredient_name, current_quantity, unit, min_threshold }), operator, now
    );

    res.json({ success: true, message: '原料库存已更新' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { operator } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();

    const oldStock = await Database.get('SELECT * FROM ingredient_stocks WHERE id = ?', id);
    if (!oldStock) {
      return res.status(404).json({ success: false, message: '原料不存在' });
    }

    await Database.run('DELETE FROM ingredient_stocks WHERE id = ?', id);

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, old_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'delete', 'ingredient_stock', id, JSON.stringify(oldStock), operator, now
    );

    res.json({ success: true, message: '原料已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
