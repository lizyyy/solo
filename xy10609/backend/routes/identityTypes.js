const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  try {
    const { search, status } = req.query;
    
    let query = 'SELECT * FROM identity_types WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const types = db.prepare(query).all(...params);
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { code, name, description, status } = req.body;
    const result = db.prepare(`
      INSERT INTO identity_types (code, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, description, status || 'active', dayjs().format(), dayjs().format());

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { code, name, description, status, changedBy } = req.body;
    const oldType = db.prepare('SELECT * FROM identity_types WHERE id = ?').get(req.params.id);
    
    if (!oldType) {
      return res.status(404).json({ success: false, message: '身份类型不存在' });
    }

    const fields = { code, name, description, status };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && oldType[key] !== value) {
        db.prepare(`
          INSERT INTO change_history (table_name, record_id, field_name, old_value, new_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('identity_types', req.params.id, key, oldType[key], value, changedBy || 'system', dayjs().format());
      }
    });

    db.prepare(`
      UPDATE identity_types 
      SET code = ?, name = ?, description = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(code, name, description, status, dayjs().format(), req.params.id);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
