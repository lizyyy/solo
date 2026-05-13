const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  try {
    const { search, status, department } = req.query;
    
    let query = `
      SELECT m.*, 
        (SELECT COUNT(*) FROM material_gaps WHERE matter_id = m.id AND is_resolved = 0) as unresolved_gaps,
        (SELECT COUNT(*) FROM exceptions WHERE matter_id = m.id AND is_fixed = 0) as unresolved_exceptions
      FROM business_matters m
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (m.name LIKE ? OR m.code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND m.status = ?';
      params.push(status);
    }

    if (department) {
      query += ' AND m.department = ?';
      params.push(department);
    }

    query += ' ORDER BY m.created_at DESC';

    const matters = db.prepare(query).all(...params);
    res.json({ success: true, data: matters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const matter = db.prepare('SELECT * FROM business_matters WHERE id = ?').get(req.params.id);
    if (!matter) {
      return res.status(404).json({ success: false, message: '办事事项不存在' });
    }
    res.json({ success: true, data: matter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { code, name, department, status } = req.body;
    const result = db.prepare(`
      INSERT INTO business_matters (code, name, department, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, department, status || 'active', dayjs().format(), dayjs().format());

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { code, name, department, status, changedBy } = req.body;
    const oldMatter = db.prepare('SELECT * FROM business_matters WHERE id = ?').get(req.params.id);
    
    if (!oldMatter) {
      return res.status(404).json({ success: false, message: '办事事项不存在' });
    }

    const fields = { code, name, department, status };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && oldMatter[key] !== value) {
        db.prepare(`
          INSERT INTO change_history (table_name, record_id, field_name, old_value, new_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('business_matters', req.params.id, key, oldMatter[key], value, changedBy || 'system', dayjs().format());
      }
    });

    db.prepare(`
      UPDATE business_matters 
      SET code = ?, name = ?, department = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(code, name, department, status, dayjs().format(), req.params.id);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
