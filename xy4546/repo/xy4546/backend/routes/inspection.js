const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      escalator_code,
      inspector,
      overall_status,
      page = 1,
      page_size = 20
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (escalator_code) {
      whereClause += ' AND escalator_code = ?';
      params.push(escalator_code);
    }

    if (inspector) {
      whereClause += ' AND inspector LIKE ?';
      params.push(`%${inspector}%`);
    }

    if (overall_status) {
      whereClause += ' AND overall_status = ?';
      params.push(overall_status);
    }

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM inspections WHERE ${whereClause}
    `, params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const records = await db.all(`
      SELECT * FROM inspections 
      WHERE ${whereClause}
      ORDER BY inspection_date DESC
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
    console.error('获取巡检记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await db.get(`
      SELECT * FROM inspections WHERE id = ?
    `, [id]);

    if (!record) {
      return res.status(404).json({ success: false, error: '巡检记录不存在' });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('获取巡检记录详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
