const express = require('express');
const { detectAnomalies, dismissAnomaly, getAnomalies } = require('../services/anomalyDetector');

const router = express.Router();

router.get('/', async (req, res) => {
  const { startDate, endDate, includeDismissed = 'false' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请提供 startDate 和 endDate' });
  }

  try {
    const includeDismissedBool = includeDismissed === 'true';
    const anomalies = await getAnomalies(startDate, endDate, includeDismissedBool);

    const byType = {};
    const bySeverity = {};
    const byDate = {};

    for (const anomaly of anomalies) {
      if (!byType[anomaly.type]) byType[anomaly.type] = 0;
      byType[anomaly.type]++;

      if (!bySeverity[anomaly.severity]) bySeverity[anomaly.severity] = 0;
      bySeverity[anomaly.severity]++;

      if (!byDate[anomaly.date]) byDate[anomaly.date] = [];
      byDate[anomaly.date].push(anomaly);
    }

    res.json({
      anomalies,
      summary: {
        total: anomalies.length,
        byType,
        bySeverity,
        byDate,
        dateRange: { startDate, endDate },
      },
    });

  } catch (error) {
    console.error('Error getting anomalies:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/detect', async (req, res) => {
  const { startDate, endDate, force = false } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: '请提供 startDate 和 endDate' });
  }

  try {
    const result = await detectAnomalies(startDate, endDate, { force });

    res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/dismiss', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await dismissAnomaly(id);

    if (!result) {
      return res.status(404).json({ error: '未找到该异常记录' });
    }

    res.json({
      success: true,
      message: '已标记为已忽略',
      anomaly: result,
    });

  } catch (error) {
    console.error('Error dismissing anomaly:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/types', async (req, res) => {
  const typeInfo = [
    {
      type: 'sleep_deficit',
      name: '睡眠不足',
      description: '当日睡眠时长低于设定的最低阈值',
      severity: 'medium',
    },
    {
      type: 'resting_hr_high',
      name: '静息心率偏高',
      description: '静息心率高于设定的阈值，可能表示身体压力或恢复不足',
      severity: 'medium',
    },
    {
      type: 'resting_hr_low',
      name: '静息心率偏低',
      description: '静息心率低于设定的阈值（通常是好的，但过低可能需要关注）',
      severity: 'low',
    },
    {
      type: 'hrv_low',
      name: '心率变异性偏低',
      description: 'HRV 偏低，通常表示身体压力较大或恢复不足',
      severity: 'medium',
    },
    {
      type: 'workout_spike',
      name: '运动量突增',
      description: '运动量较前一周平均值显著增加，请注意恢复',
      severity: 'medium',
    },
    {
      type: 'data_missing',
      name: '数据缺失',
      description: '当日没有健康数据记录，可能未佩戴设备或数据未同步',
      severity: 'medium',
    },
    {
      type: 'steps_low',
      name: '活动量过低',
      description: '当日步数低于阈值，可能数据缺失或当日活动极少',
      severity: 'low',
    },
    {
      type: 'sleep_debt_accumulated',
      name: '睡眠债累积',
      description: '一段时间内累计睡眠债超过阈值',
      severity: 'high',
    },
    {
      type: 'recovery_insufficient',
      name: '恢复不足警告',
      description: '连续运动后睡眠不足且 HRV 偏低，身体可能过度疲劳',
      severity: 'high',
    },
  ];

  res.json({
    types: typeInfo,
    total: typeInfo.length,
  });
});

router.get('/stats', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    let whereClause = '';
    const params = [];

    if (startDate) {
      whereClause += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND date <= ?';
      params.push(endDate);
    }

    const db = require('../database');

    const total = db.get(`
      SELECT COUNT(*) as count FROM anomalies WHERE 1=1 ${whereClause}
    `, params);

    const bySeverity = db.all(`
      SELECT severity, COUNT(*) as count 
      FROM anomalies 
      WHERE 1=1 ${whereClause}
      GROUP BY severity
    `, params);

    const byType = db.all(`
      SELECT type, COUNT(*) as count 
      FROM anomalies 
      WHERE 1=1 ${whereClause}
      GROUP BY type
      ORDER BY count DESC
    `, params);

    const byDate = db.all(`
      SELECT date, COUNT(*) as count,
             SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
             SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
             SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
             SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low
      FROM anomalies 
      WHERE 1=1 ${whereClause}
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `, params);

    const dismissed = db.get(`
      SELECT COUNT(*) as count FROM anomalies 
      WHERE is_dismissed = 1 ${whereClause}
    `, params);

    res.json({
      total: total?.count || 0,
      dismissed: dismissed?.count || 0,
      active: (total?.count || 0) - (dismissed?.count || 0),
      bySeverity: bySeverity.reduce((acc, s) => ({ ...acc, [s.severity]: s.count }), {}),
      byType: byType,
      recentByDate: byDate,
      dateRange: startDate && endDate ? { startDate, endDate } : null,
    });

  } catch (error) {
    console.error('Error getting anomaly stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
