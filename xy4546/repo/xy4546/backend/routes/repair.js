const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      escalator_code,
      handle_status,
      severity,
      is_false_alarm,
      page = 1,
      page_size = 20
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (escalator_code) {
      whereClause += ' AND escalator_code = ?';
      params.push(escalator_code);
    }

    if (handle_status) {
      whereClause += ' AND handle_status = ?';
      params.push(handle_status);
    }

    if (severity) {
      whereClause += ' AND severity = ?';
      params.push(severity);
    }

    if (is_false_alarm !== undefined && is_false_alarm !== '') {
      whereClause += ' AND is_false_alarm = ?';
      params.push(parseInt(is_false_alarm));
    }

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM repair_records WHERE ${whereClause}
    `, params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const records = await db.all(`
      SELECT * FROM repair_records 
      WHERE ${whereClause}
      ORDER BY report_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(page_size), offset]);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countResult.total,
          total_pages: Math.ceil(countResult.total / parseInt(page_size))
        }
      }
    });
  } catch (error) {
    console.error('获取报修记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await db.get(`
      SELECT * FROM repair_records WHERE id = ?
    `, [id]);

    if (!record) {
      return res.status(404).json({ success: false, error: '报修记录不存在' });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('获取报修记录详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      handle_status,
      handle_time,
      handler,
      handle_result,
      is_false_alarm,
      remarks
    } = req.body;

    const existing = await db.get('SELECT * FROM repair_records WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '报修记录不存在' });
    }

    await db.run(`
      UPDATE repair_records SET
        handle_status = ?,
        handle_time = ?,
        handler = ?,
        handle_result = ?,
        is_false_alarm = ?,
        remarks = ?
      WHERE id = ?
    `, [
      handle_status || existing.handle_status,
      handle_time || existing.handle_time,
      handler || existing.handler,
      handle_result || existing.handle_result,
      is_false_alarm !== undefined ? is_false_alarm : existing.is_false_alarm,
      remarks !== undefined ? remarks : existing.remarks,
      id
    ]);

    const updated = await db.get('SELECT * FROM repair_records WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '报修记录更新成功',
      data: updated
    });
  } catch (error) {
    console.error('更新报修记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
