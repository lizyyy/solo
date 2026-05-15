const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { matterId, status } = req.query;
    
    let sql = `
      SELECT co.*, m.name as matter_name, a.name as attachment_name
      FROM correction_opinions co
      LEFT JOIN business_matters m ON co.matter_id = m.id
      LEFT JOIN attachments a ON co.attachment_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (matterId) {
      sql += ' AND co.matter_id = ?';
      params.push(matterId);
    }

    if (status) {
      sql += ' AND co.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY co.created_at DESC';

    const opinions = await db.all(sql, params);
    res.json({ success: true, data: opinions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { matter_id, attachment_id, opinion, handler, status } = req.body;
    const result = await db.run(`
      INSERT INTO correction_opinions (matter_id, attachment_id, opinion, handler, handle_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [matter_id, attachment_id, opinion, handler || null, dayjs().format(), status || 'pending', dayjs().format()]);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { opinion, handler, status } = req.body;
    await db.run(`
      UPDATE correction_opinions 
      SET opinion = ?, handler = ?, status = ?, handle_time = ?
      WHERE id = ?
    `, [opinion, handler, status, dayjs().format(), req.params.id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM correction_opinions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
