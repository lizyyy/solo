const express = require('express');
const { getAsync } = require('../database');

const router = express.Router();

router.get('/anomalies', async (req, res) => {
  const db = getAsync();
  const { confirmed, device_code, limit = 50, offset = 0 } = req.query;

  try {
    let sql = `
      SELECT 
        a.*,
        r.device_code,
        r.reading_time,
        r.temperature,
        r.pressure
      FROM anomalies a
      JOIN readings r ON a.reading_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (confirmed !== undefined) {
      sql += ' AND a.confirmed = ?';
      params.push(confirmed === 'true' || confirmed === '1' ? 1 : 0);
    }

    if (device_code) {
      sql += ' AND r.device_code = ?';
      params.push(device_code);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const anomalies = await db.all(sql, ...params);

    res.json({
      success: true,
      data: anomalies.map(a => ({
        ...a,
        confirmed: a.confirmed === 1
      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/anomalies/:id/confirm', async (req, res) => {
  const db = getAsync();
  const { id } = req.params;
  const { confirmed_by } = req.body;

  try {
    const anomaly = await db.get(`
      SELECT a.*, r.device_code, r.reading_time
      FROM anomalies a
      JOIN readings r ON a.reading_id = r.id
      WHERE a.id = ?
    `, id);

    if (!anomaly) {
      return res.status(404).json({
        success: false,
        error: '异常记录不存在'
      });
    }

    if (anomaly.confirmed === 1) {
      return res.status(400).json({
        success: false,
        error: '该异常已确认'
      });
    }

    const now = new Date().toISOString();
    await db.run(
      'UPDATE anomalies SET confirmed = 1, confirmed_by = ?, confirmed_at = ? WHERE id = ?',
      confirmed_by || 'unknown',
      now,
      id
    );

    const updated = await db.get(`
      SELECT a.*, r.device_code, r.reading_time
      FROM anomalies a
      JOIN readings r ON a.reading_id = r.id
      WHERE a.id = ?
    `, id);

    res.json({
      success: true,
      message: '异常确认成功',
      data: {
        ...updated,
        confirmed: true
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/anomalies/batch-confirm', async (req, res) => {
  const db = getAsync();
  const { ids, confirmed_by } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: '请提供要确认的异常ID列表'
    });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const now = new Date().toISOString();

    const result = await db.run(
      `UPDATE anomalies SET confirmed = 1, confirmed_by = ?, confirmed_at = ?
       WHERE id IN (${placeholders}) AND confirmed = 0`,
      confirmed_by || 'unknown',
      now,
      ...ids
    );

    res.json({
      success: true,
      message: `成功确认 ${result.changes} 条异常记录`,
      data: {
        confirmed_count: result.changes,
        ids
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
