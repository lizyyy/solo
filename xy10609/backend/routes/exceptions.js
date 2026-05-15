const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { matterId, isFixed } = req.query;
    
    let sql = `
      SELECT e.*, m.name as matter_name, a.name as attachment_name
      FROM exceptions e
      LEFT JOIN business_matters m ON e.matter_id = m.id
      LEFT JOIN attachments a ON e.attachment_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (matterId) {
      sql += ' AND e.matter_id = ?';
      params.push(matterId);
    }

    if (isFixed !== undefined) {
      sql += ' AND e.is_fixed = ?';
      params.push(isFixed === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY e.created_at DESC';

    const exceptions = await db.all(sql, params);
    res.json({ success: true, data: exceptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { matter_id, exception_type, reason, attachment_id, handler, before_value, after_value } = req.body;
    const result = await db.run(`
      INSERT INTO exceptions (matter_id, exception_type, reason, attachment_id, handler, before_value, after_value, is_fixed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [matter_id, exception_type, reason, attachment_id, handler, before_value, after_value, dayjs().format()]);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/fix', async (req, res) => {
  try {
    const { handler, after_value } = req.body;
    await db.run(`
      UPDATE exceptions 
      SET is_fixed = 1, handler = ?, after_value = ?, fixed_time = ?
      WHERE id = ?
    `, [handler, after_value, dayjs().format(), req.params.id]);

    res.json({ success: true, message: '异常已修复' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
