const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    
    let sql = 'SELECT * FROM identity_types WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const types = await db.all(sql, params);
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { code, name, description, status } = req.body;
    const result = await db.run(`
      INSERT INTO identity_types (code, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [code, name, description, status || 'active', dayjs().format(), dayjs().format()]);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { code, name, description, status, changedBy } = req.body;
    const oldType = await db.get('SELECT * FROM identity_types WHERE id = ?', [req.params.id]);
    
    if (!oldType) {
      return res.status(404).json({ success: false, message: '身份类型不存在' });
    }

    const fields = { code, name, description, status };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && oldType[key] !== value) {
        await db.run(`
          INSERT INTO change_history (table_name, record_id, field_name, old_value, new_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['identity_types', req.params.id, key, oldType[key], value, changedBy || 'system', dayjs().format()]);
      }
    }

    await db.run(`
      UPDATE identity_types 
      SET code = ?, name = ?, description = ?, status = ?, updated_at = ?
      WHERE id = ?
    `, [code, name, description, status, dayjs().format(), req.params.id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
