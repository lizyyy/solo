const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { requirePermission, PERMISSIONS, maskSensitiveFields } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const moment = require('moment');

const MIN_TEMP = -10;
const MAX_TEMP = 10;

router.post('/', requirePermission(PERMISSIONS.TEMPERATURE_CREATE), async (req, res) => {
  try {
    const { refrigeratorId, refrigeratorName, temperature, measureTime, comment } = req.body;

    if (!refrigeratorId || !refrigeratorName || temperature === undefined || !measureTime) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const temp = parseFloat(temperature);
    if (isNaN(temp)) {
      return res.status(400).json({ success: false, message: '温度必须是数字' });
    }

    const measureMoment = moment(measureTime);
    if (!measureMoment.isValid()) {
      return res.status(400).json({ success: false, message: '时间格式无效' });
    }

    let status = 'normal';
    if (temp < MIN_TEMP || temp > MAX_TEMP) {
      status = 'abnormal';
    }

    db.run(`
      INSERT INTO temperature_records (
        refrigerator_id, refrigerator_name, temperature, measure_time, operator_id, status, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [refrigeratorId, refrigeratorName, temp, measureMoment.format(), req.user.id, status, comment], async function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '创建温度记录失败', error: err.message });
      }

      await logAction(
        req.user.id,
        'CREATE_TEMPERATURE',
        'temperature_records',
        this.lastID,
        null,
        req.body,
        req.ip,
        req.get('User-Agent')
      );

      res.status(201).json({
        success: true,
        message: '温度记录创建成功',
        data: { id: this.lastID, status }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/', requirePermission(PERMISSIONS.TEMPERATURE_READ), async (req, res) => {
  try {
    const { status, refrigeratorId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        t.*,
        u.real_name as operator_name
      FROM temperature_records t
      LEFT JOIN users u ON t.operator_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (refrigeratorId) {
      query += ' AND t.refrigerator_id = ?';
      params.push(refrigeratorId);
    }

    if (startDate) {
      query += ' AND t.measure_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND t.measure_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY t.measure_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      const maskedData = maskSensitiveFields(rows, req.user.role);

      db.get('SELECT COUNT(*) as total FROM temperature_records', (countErr, countRow) => {
        res.json({
          success: true,
          data: maskedData,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countRow.total
          }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/summary', requirePermission(PERMISSIONS.TEMPERATURE_READ), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        refrigerator_id,
        refrigerator_name,
        COUNT(*) as total_records,
        AVG(temperature) as avg_temp,
        MIN(temperature) as min_temp,
        MAX(temperature) as max_temp,
        SUM(CASE WHEN status = 'abnormal' THEN 1 ELSE 0 END) as abnormal_count
      FROM temperature_records
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND measure_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND measure_time <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY refrigerator_id, refrigerator_name';

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      res.json({ success: true, data: rows });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

module.exports = router;
