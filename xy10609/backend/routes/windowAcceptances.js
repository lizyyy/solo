const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { matterId, acceptor } = req.query;
    
    let sql = `
      SELECT wa.*, m.name as matter_name
      FROM window_acceptances wa
      LEFT JOIN business_matters m ON wa.matter_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (matterId) {
      sql += ' AND wa.matter_id = ?';
      params.push(matterId);
    }

    if (acceptor) {
      sql += ' AND wa.acceptor LIKE ?';
      params.push(`%${acceptor}%`);
    }

    sql += ' ORDER BY wa.created_at DESC';

    const acceptances = await db.all(sql, params);
    res.json({ success: true, data: acceptances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { matter_id, window_no, acceptor, material_check_result, remarks } = req.body;
    const result = await db.run(`
      INSERT INTO window_acceptances (matter_id, window_no, acceptor, accept_time, material_check_result, remarks, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [matter_id, window_no, acceptor, dayjs().format(), material_check_result || 'pending', remarks || null, dayjs().format()]);

    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { window_no, acceptor, material_check_result, remarks } = req.body;
    await db.run(`
      UPDATE window_acceptances 
      SET window_no = ?, acceptor = ?, material_check_result = ?, remarks = ?, accept_time = ?
      WHERE id = ?
    `, [window_no, acceptor, material_check_result, remarks, dayjs().format(), req.params.id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM window_acceptances WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
