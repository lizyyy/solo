const express = require('express');
const db = require('../database');
const riskDetection = require('../utils/riskDetection');
const moment = require('moment');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      station_name,
      escalator_code,
      risk_type,
      risk_level,
      status,
      is_reopened,
      page = 1,
      page_size = 20
    } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (station_name) {
      whereClause += ' AND e.station_name = ?';
      params.push(station_name);
    }

    if (escalator_code) {
      whereClause += ' AND r.escalator_code = ?';
      params.push(escalator_code);
    }

    if (risk_type) {
      whereClause += ' AND r.risk_type = ?';
      params.push(risk_type);
    }

    if (risk_level) {
      whereClause += ' AND r.risk_level = ?';
      params.push(risk_level);
    }

    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }

    if (is_reopened) {
      whereClause += ' AND r.is_reopened = 1';
    }

    const countResult = await db.get(`
      SELECT COUNT(*) as total FROM risks r
      LEFT JOIN escalators e ON r.escalator_code = e.escalator_code
      WHERE ${whereClause}
    `, params);

    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const risks = await db.all(`
      SELECT r.*, e.station_name, e.location
      FROM risks r
      LEFT JOIN escalators e ON r.escalator_code = e.escalator_code
      WHERE ${whereClause}
      ORDER BY 
        CASE r.risk_level 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        r.detected_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(page_size), offset]);

    res.json({
      success: true,
      data: {
        risks,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countResult.total,
          total_pages: Math.ceil(countResult.total / parseInt(page_size))
        }
      }
    });
  } catch (error) {
    console.error('获取风险列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const risk = await db.get(`
      SELECT r.*, e.station_name, e.location, e.manufacturer
      FROM risks r
      LEFT JOIN escalators e ON r.escalator_code = e.escalator_code
      WHERE r.id = ?
    `, [id]);

    if (!risk) {
      return res.status(404).json({ success: false, error: '风险记录不存在' });
    }

    const statusLogs = await db.all(`
      SELECT * FROM risk_status_logs 
      WHERE risk_id = ? 
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        risk,
        statusLogs
      }
    });
  } catch (error) {
    console.error('获取风险详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/detect', async (req, res) => {
  try {
    const { escalator_code, options } = req.body;

    let detectedRisks;
    if (escalator_code) {
      detectedRisks = await riskDetection.detectAllRisksForEscalator(escalator_code, options);
    } else {
      detectedRisks = await riskDetection.detectAllRisks(options);
    }

    res.json({
      success: true,
      message: `检测完成，发现 ${detectedRisks.length} 个风险`,
      data: {
        risks: detectedRisks,
        count: detectedRisks.length
      }
    });
  } catch (error) {
    console.error('风险检测失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/judgment', async (req, res) => {
  try {
    const { id } = req.params;
    const { manual_judgment, manual_remarks, operator } = req.body;

    const existingRisk = await db.get('SELECT * FROM risks WHERE id = ?', [id]);
    if (!existingRisk) {
      return res.status(404).json({ success: false, error: '风险记录不存在' });
    }

    await db.run(`
      UPDATE risks SET 
        manual_judgment = ?,
        manual_remarks = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      manual_judgment,
      manual_remarks,
      moment().format('YYYY-MM-DD HH:mm:ss'),
      id
    ]);

    await db.run(`
      INSERT INTO risk_status_logs (risk_id, old_status, new_status, operator, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [
      id,
      existingRisk.manual_judgment || 'none',
      manual_judgment,
      operator || '系统',
      `人工判改：${manual_judgment}${manual_remarks ? '，备注：' + manual_remarks : ''}`
    ]);

    const updatedRisk = await db.get('SELECT * FROM risks WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '人工判改成功',
      data: updatedRisk
    });
  } catch (error) {
    console.error('人工判改失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolver, resolve_description, operator } = req.body;

    const existingRisk = await db.get('SELECT * FROM risks WHERE id = ?', [id]);
    if (!existingRisk) {
      return res.status(404).json({ success: false, error: '风险记录不存在' });
    }

    const updateFields = ['status = ?', 'updated_at = ?'];
    const params = [status, moment().format('YYYY-MM-DD HH:mm:ss')];

    if (status === 'resolved') {
      updateFields.push('resolved_time = ?');
      params.push(moment().format('YYYY-MM-DD HH:mm:ss'));
      
      if (resolver) {
        updateFields.push('resolver = ?');
        params.push(resolver);
      }
      
      if (resolve_description) {
        updateFields.push('resolve_description = ?');
        params.push(resolve_description);
      }
    }

    params.push(id);

    await db.run(`
      UPDATE risks SET ${updateFields.join(', ')}
      WHERE id = ?
    `, params);

    await db.run(`
      INSERT INTO risk_status_logs (risk_id, old_status, new_status, operator, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [
      id,
      existingRisk.status,
      status,
      operator || '系统',
      `状态变更：${existingRisk.status} → ${status}${resolve_description ? '，处理说明：' + resolve_description : ''}`
    ]);

    const updatedRisk = await db.get('SELECT * FROM risks WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '状态更新成功',
      data: updatedRisk
    });
  } catch (error) {
    console.error('状态更新失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics/overview', async (req, res) => {
  try {
    const totalRisks = await db.get(`
      SELECT COUNT(*) as count FROM risks
    `);

    const pendingRisks = await db.get(`
      SELECT COUNT(*) as count FROM risks WHERE status = 'pending'
    `);

    const riskByType = await db.all(`
      SELECT risk_type, COUNT(*) as count 
      FROM risks 
      GROUP BY risk_type
    `);

    const riskByLevel = await db.all(`
      SELECT risk_level, COUNT(*) as count 
      FROM risks 
      GROUP BY risk_level
    `);

    const reopenedRisks = await db.get(`
      SELECT COUNT(*) as count FROM risks WHERE is_reopened = 1
    `);

    const escalatorsWithRisks = await db.get(`
      SELECT COUNT(DISTINCT escalator_code) as count FROM risks
    `);

    res.json({
      success: true,
      data: {
        totalRisks: totalRisks.count,
        pendingRisks: pendingRisks.count,
        reopenedRisks: reopenedRisks.count,
        escalatorsWithRisks: escalatorsWithRisks.count,
        riskByType,
        riskByLevel
      }
    });
  } catch (error) {
    console.error('获取统计概览失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
