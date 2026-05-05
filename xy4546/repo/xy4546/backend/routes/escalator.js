const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { station_name, status, page = 1, page_size = 100 } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (station_name) {
      whereClause += ' AND station_name = ?';
      params.push(station_name);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM escalators WHERE ${whereClause}
    `, params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const escalators = await db.all(`
      SELECT * FROM escalators 
      WHERE ${whereClause}
      ORDER BY station_name, escalator_code
      LIMIT ? OFFSET ?
    `, [...params, parseInt(page_size), offset]);

    res.json({
      success: true,
      data: {
        escalators,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countResult.total,
          total_pages: Math.ceil(countResult.total / parseInt(page_size))
        }
      }
    });
  } catch (error) {
    console.error('获取扶梯列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stations', async (req, res) => {
  try {
    const stations = await db.all(`
      SELECT DISTINCT station_name 
      FROM escalators 
      ORDER BY station_name
    `);

    res.json({
      success: true,
      data: stations.map(s => s.station_name)
    });
  } catch (error) {
    console.error('获取站点列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:escalator_code', async (req, res) => {
  try {
    const { escalator_code } = req.params;

    const escalator = await db.get(`
      SELECT * FROM escalators WHERE escalator_code = ?
    `, [escalator_code]);

    if (!escalator) {
      return res.status(404).json({ success: false, error: '扶梯不存在' });
    }

    const latestInspection = await db.get(`
      SELECT * FROM inspections 
      WHERE escalator_code = ? 
      ORDER BY inspection_date DESC 
      LIMIT 1
    `, [escalator_code]);

    const latestCurrentLog = await db.get(`
      SELECT * FROM current_logs 
      WHERE escalator_code = ? 
      ORDER BY log_time DESC 
      LIMIT 1
    `, [escalator_code]);

    const pendingRepairs = await db.all(`
      SELECT * FROM repair_records 
      WHERE escalator_code = ? AND handle_status IN ('pending', 'processing')
      ORDER BY report_time DESC
    `, [escalator_code]);

    const unresolvedMaintenance = await db.all(`
      SELECT * FROM maintenance_records 
      WHERE escalator_code = ? AND is_resolved = 0
      ORDER BY call_time DESC
    `, [escalator_code]);

    const risks = await db.all(`
      SELECT * FROM risks 
      WHERE escalator_code = ? AND status = 'pending'
      ORDER BY 
        CASE risk_level 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        detected_time DESC
    `, [escalator_code]);

    res.json({
      success: true,
      data: {
        escalator,
        latestInspection,
        latestCurrentLog,
        pendingRepairs,
        unresolvedMaintenance,
        risks
      }
    });
  } catch (error) {
    console.error('获取扶梯详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
