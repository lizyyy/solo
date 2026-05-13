const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Database } = require('../utils/db');

router.get('/', async (req, res) => {
  try {
    const ovens = await Database.all('SELECT * FROM oven_capacities WHERE is_active = 1 ORDER BY created_at DESC');
    res.json({ success: true, data: ovens });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const oven = await Database.get('SELECT * FROM oven_capacities WHERE id = ?', req.params.id);
    if (!oven) {
      return res.status(404).json({ success: false, message: '烤炉不存在' });
    }
    const versions = await Database.all('SELECT * FROM oven_capacity_versions WHERE capacity_id = ? ORDER BY version DESC', req.params.id);
    res.json({ success: true, data: { ...oven, versions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { oven_name, max_batches, batch_size, available_hours, operator } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    await Database.run(
      'INSERT INTO oven_capacities (id, oven_name, max_batches, batch_size, available_hours, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, oven_name, max_batches, batch_size, available_hours, now, now
    );

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, new_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'create', 'oven_capacity', id, JSON.stringify({ oven_name, max_batches, batch_size, available_hours }), operator, now
    );

    res.json({ success: true, data: { id, oven_name, max_batches, batch_size, available_hours } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { oven_name, max_batches, batch_size, available_hours, operator } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();

    const oldOven = await Database.get('SELECT * FROM oven_capacities WHERE id = ?', id);
    if (!oldOven) {
      return res.status(404).json({ success: false, message: '烤炉不存在' });
    }

    const versionRow = await Database.get('SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM oven_capacity_versions WHERE capacity_id = ?', id);
    const version = versionRow.next_version;

    await Database.run(
      'INSERT INTO oven_capacity_versions (id, capacity_id, oven_name, max_batches, batch_size, available_hours, version, modified_by, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), id, oldOven.oven_name, oldOven.max_batches, oldOven.batch_size, oldOven.available_hours, version, operator, now
    );

    await Database.run(
      'UPDATE oven_capacities SET oven_name = ?, max_batches = ?, batch_size = ?, available_hours = ?, updated_at = ? WHERE id = ?',
      oven_name, max_batches, batch_size, available_hours, now, id
    );

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, old_value, new_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'update', 'oven_capacity', id, JSON.stringify(oldOven), JSON.stringify({ oven_name, max_batches, batch_size, available_hours }), operator, now
    );

    res.json({ success: true, message: '烤炉容量已更新' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { operator } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();

    const oldOven = await Database.get('SELECT * FROM oven_capacities WHERE id = ?', id);
    if (!oldOven) {
      return res.status(404).json({ success: false, message: '烤炉不存在' });
    }

    await Database.run('UPDATE oven_capacities SET is_active = 0, updated_at = ? WHERE id = ?', now, id);

    await Database.run(
      'INSERT INTO operation_logs (id, operation_type, entity_type, entity_id, old_value, operator, operation_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), 'delete', 'oven_capacity', id, JSON.stringify(oldOven), operator, now
    );

    res.json({ success: true, message: '烤炉已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
