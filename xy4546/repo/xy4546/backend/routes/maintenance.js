const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      escalator_code,
      is_resolved,
      technician_name,
      page = 1,
      page_size = 20
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (escalator_code) {
      whereClause += ' AND escalator_code = ?';
      params.push(escalator_code);
    }

    if (is_resolved !== undefined && is_resolved !== '') {
      whereClause += ' AND is_resolved = ?';
      params.push(parseInt(is_resolved));
    }

    if (technician_name) {
      whereClause += ' AND technician_name LIKE ?';
      params.push(`%${technician_name}%`);
    }

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM maintenance_records WHERE ${whereClause}
    `, params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const records = await db.all(`
      SELECT * FROM maintenance_records 
      WHERE ${whereClause}
      ORDER BY call_time DESC
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
    console.error('获取维保记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await db.get(`
      SELECT * FROM maintenance_records WHERE id = ?
    `, [id]);

    if (!record) {
      return res.status(404).json({ success: false, error: '维保记录不存在' });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('获取维保记录详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      arrival_time,
      departure_time,
      maintenance_content,
      parts_replaced,
      maintenance_result,
      is_resolved,
      next_maintenance_date,
      remarks
    } = req.body;

    const existing = await db.get('SELECT * FROM maintenance_records WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '维保记录不存在' });
    }

    await db.run(`
      UPDATE maintenance_records SET
        arrival_time = ?,
        departure_time = ?,
        maintenance_content = ?,
        parts_replaced = ?,
        maintenance_result = ?,
        is_resolved = ?,
        next_maintenance_date = ?,
        remarks = ?
      WHERE id = ?
    `, [
      arrival_time || existing.arrival_time,
      departure_time || existing.departure_time,
      maintenance_content || existing.maintenance_content,
      parts_replaced || existing.parts_replaced,
      maintenance_result || existing.maintenance_result,
      is_resolved !== undefined ? is_resolved : existing.is_resolved,
      next_maintenance_date || existing.next_maintenance_date,
      remarks !== undefined ? remarks : existing.remarks,
      id
    ]);

    const updated = await db.get('SELECT * FROM maintenance_records WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '维保记录更新成功',
      data: updated
    });
  } catch (error) {
    console.error('更新维保记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
