const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { search, matterId, status } = req.query;
    
    let sql = `
      SELECT a.*, m.name as matter_name, it.name as identity_name
      FROM attachments a
      LEFT JOIN business_matters m ON a.matter_id = m.id
      LEFT JOIN identity_types it ON a.identity_type_id = it.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND a.name LIKE ?';
      params.push(`%${search}%`);
    }

    if (matterId) {
      sql += ' AND a.matter_id = ?';
      params.push(matterId);
    }

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.created_at DESC';

    const attachments = await db.all(sql, params);
    res.json({ success: true, data: attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, matter_id, identity_type_id, expire_date, status } = req.body;
    const result = await db.run(`
      INSERT INTO attachments (name, matter_id, identity_type_id, expire_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, matter_id, identity_type_id, expire_date, status || 'valid', dayjs().format(), dayjs().format()]);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, matter_id, identity_type_id, expire_date, status, changedBy } = req.body;
    const oldAttachment = await db.get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
    
    if (!oldAttachment) {
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    const fields = { name, matter_id, identity_type_id, expire_date, status };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && oldAttachment[key] !== value) {
        await db.run(`
          INSERT INTO change_history (table_name, record_id, field_name, old_value, new_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['attachments', req.params.id, key, oldAttachment[key], value, changedBy || 'system', dayjs().format()]);
      }
    }

    await db.run(`
      UPDATE attachments 
      SET name = ?, matter_id = ?, identity_type_id = ?, expire_date = ?, status = ?, updated_at = ?
      WHERE id = ?
    `, [name, matter_id, identity_type_id, expire_date, status, dayjs().format(), req.params.id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
