const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      escalator_code,
      is_overload,
      start_time,
      end_time,
      page = 1,
      page_size = 100
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (escalator_code) {
      whereClause += ' AND escalator_code = ?';
      params.push(escalator_code);
    }

    if (is_overload !== undefined && is_overload !== '') {
      whereClause += ' AND is_overload = ?';
      params.push(parseInt(is_overload));
    }

    if (start_time) {
      whereClause += ' AND log_time >= ?';
      params.push(start_time);
    }

    if (end_time) {
      whereClause += ' AND log_time <= ?';
      params.push(end_time);
    }

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM current_logs WHERE ${whereClause}
    `, params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const records = await db.all(`
      SELECT * FROM current_logs 
      WHERE ${whereClause}
      ORDER BY log_time DESC
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
    console.error('获取电流日志失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics/:escalator_code', async (req, res) => {
  try {
    const { escalator_code } = req.params;
    const { start_time, end_time } = req.query;

    let whereClause = 'escalator_code = ?';
    const params = [escalator_code];

    if (start_time) {
      whereClause += ' AND log_time >= ?';
      params.push(start_time);
    }

    if (end_time) {
      whereClause += ' AND log_time <= ?';
      params.push(end_time);
    }

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_records,
        AVG(average_current) as avg_current,
        MAX(average_current) as max_current,
        MIN(average_current) as min_current,
        SUM(CASE WHEN is_overload = 1 THEN 1 ELSE 0 END) as overload_count
      FROM current_logs 
      WHERE ${whereClause}
    `, params);

    const latestOverloads = await db.all(`
      SELECT * FROM current_logs 
      WHERE ${whereClause} AND is_overload = 1
      ORDER BY log_time DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        statistics: stats,
        latestOverloads
      }
    });
  } catch (error) {
    console.error('获取电流日志统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
