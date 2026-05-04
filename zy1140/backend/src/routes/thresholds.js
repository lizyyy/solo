const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    let query = `SELECT * FROM thresholds`;
    const params = [];

    if (category) {
      query += ` WHERE category = ?`;
      params.push(category);
    }

    query += ` ORDER BY category, key`;

    const thresholds = db.all(query, params);

    const grouped = {};
    for (const t of thresholds) {
      if (!grouped[t.category]) {
        grouped[t.category] = [];
      }
      grouped[t.category].push({
        id: t.id,
        key: t.key,
        value: t.value,
        label: t.label,
        description: t.description,
        unit: t.unit,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      });
    }

    res.json({
      thresholds,
      grouped,
      categories: Object.keys(grouped).sort(),
      total: thresholds.length,
    });

  } catch (error) {
    console.error('Error getting thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:category/:key', async (req, res) => {
  const { category, key } = req.params;

  try {
    const threshold = db.get(
      `SELECT * FROM thresholds WHERE category = ? AND key = ?`,
      [category, key]
    );

    if (!threshold) {
      return res.status(404).json({ error: '未找到该阈值配置' });
    }

    res.json({
      ...threshold,
    });

  } catch (error) {
    console.error('Error getting threshold:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:category/:key', async (req, res) => {
  const { category, key } = req.params;
  const { value, label, description, unit } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: '请提供阈值 value' });
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return res.status(400).json({ error: 'value 必须是数字' });
  }

  try {
    const existing = db.get(
      `SELECT id FROM thresholds WHERE category = ? AND key = ?`,
      [category, key]
    );

    const now = new Date().toISOString();

    if (existing) {
      const current = db.get(
        `SELECT * FROM thresholds WHERE category = ? AND key = ?`,
        [category, key]
      );

      db.run(`
        UPDATE thresholds 
        SET value = ?, label = ?, description = ?, unit = ?, updated_at = ?
        WHERE category = ? AND key = ?
      `, [
        numValue,
        label || current.label,
        description !== undefined ? description : current.description,
        unit !== undefined ? unit : current.unit,
        now,
        category,
        key
      ]);
    } else {
      const id = `threshold_${Date.now()}`;
      db.run(`
        INSERT INTO thresholds (id, category, key, value, label, description, unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        category,
        key,
        numValue,
        label || buildDefaultLabel(category, key),
        description || '',
        unit || '',
        now,
        now
      ]);
    }

    const updated = db.get(
      `SELECT * FROM thresholds WHERE category = ? AND key = ?`,
      [category, key]
    );

    res.json({
      success: true,
      threshold: updated,
      wasCreated: !existing,
    });

  } catch (error) {
    console.error('Error saving threshold:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/batch', async (req, res) => {
  const { thresholds } = req.body;

  if (!Array.isArray(thresholds)) {
    return res.status(400).json({ error: 'thresholds 必须是数组' });
  }

  try {
    const results = [];
    const errors = [];
    const now = new Date().toISOString();

    for (const t of thresholds) {
      if (!t.category || !t.key || t.value === undefined) {
        errors.push({ threshold: t, error: '缺少必要字段: category, key, value' });
        continue;
      }

      const numValue = parseFloat(t.value);
      if (isNaN(numValue)) {
        errors.push({ threshold: t, error: 'value 必须是数字' });
        continue;
      }

      try {
        const existing = db.get(
          `SELECT id FROM thresholds WHERE category = ? AND key = ?`,
          [t.category, t.key]
        );

        if (existing) {
          db.run(`
            UPDATE thresholds 
            SET value = ?, label = ?, description = ?, unit = ?, updated_at = ?
            WHERE category = ? AND key = ?
          `, [
            numValue,
            t.label || existing.label,
            t.description !== undefined ? t.description : existing.description,
            t.unit !== undefined ? t.unit : existing.unit,
            now,
            t.category,
            t.key
          ]);
        } else {
          const id = `threshold_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          db.run(`
            INSERT INTO thresholds (id, category, key, value, label, description, unit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            t.category,
            t.key,
            numValue,
            t.label || buildDefaultLabel(t.category, t.key),
            t.description || '',
            t.unit || '',
            now,
            now
          ]);
        }

        results.push({
          category: t.category,
          key: t.key,
          value: numValue,
          success: true,
          wasCreated: !existing,
        });

      } catch (e) {
        errors.push({ threshold: t, error: e.message });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors,
      total: thresholds.length,
      successful: results.length,
      failed: errors.length,
    });

  } catch (error) {
    console.error('Error batch updating thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:category/:key', async (req, res) => {
  const { category, key } = req.params;

  try {
    const existing = db.get(
      `SELECT id FROM thresholds WHERE category = ? AND key = ?`,
      [category, key]
    );

    if (!existing) {
      return res.status(404).json({ error: '未找到该阈值配置' });
    }

    db.run(
      `DELETE FROM thresholds WHERE category = ? AND key = ?`,
      [category, key]
    );

    res.json({
      success: true,
      message: `已删除阈值配置: ${category}.${key}`,
      category,
      key,
    });

  } catch (error) {
    console.error('Error deleting threshold:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/reset', async (req, res) => {
  const { categories } = req.body;

  try {
    const defaultThresholds = [
      { category: 'sleep', key: 'target_hours', value: 7.5, label: '目标睡眠时长', description: '每日推荐睡眠时长', unit: '小时' },
      { category: 'sleep', key: 'min_acceptable', value: 6, label: '最低可接受睡眠', description: '低于此值视为睡眠不足', unit: '小时' },
      { category: 'sleep', key: 'consecutive_bad_days', value: 3, label: '连续睡眠不足天数', description: '连续多少天睡眠不足触发预警', unit: '天' },
      
      { category: 'heart_rate', key: 'resting_high', value: 80, label: '静息心率偏高阈值', description: '静息心率高于此值视为偏高', unit: 'bpm' },
      { category: 'heart_rate', key: 'resting_low', value: 40, label: '静息心率偏低阈值', description: '静息心率低于此值视为偏低', unit: 'bpm' },
      { category: 'heart_rate', key: 'variability_low', value: 20, label: 'HRV 偏低阈值', description: '心率变异性低于此值视为偏低', unit: 'ms' },
      
      { category: 'activity', key: 'steps_target', value: 10000, label: '每日步数目标', description: '每日推荐步数', unit: '步' },
      { category: 'activity', key: 'steps_low', value: 1000, label: '步数过低阈值', description: '低于此值可能数据缺失或活动极少', unit: '步' },
      { category: 'activity', key: 'workout_sudden_increase', value: 2.0, label: '运动量突增比例', description: '较前7天平均值增加多少倍视为突增', unit: '倍' },
      
      { category: 'recovery', key: 'sleep_debt_threshold', value: 5, label: '累计睡眠债阈值', description: '累计睡眠债超过此小时数预警', unit: '小时' },
    ];

    let thresholdsToReset = defaultThresholds;
    if (categories && Array.isArray(categories)) {
      thresholdsToReset = defaultThresholds.filter(t => categories.includes(t.category));
    }

    const now = new Date().toISOString();
    let resetCount = 0;

    for (const t of thresholdsToReset) {
      const existing = db.get(
        `SELECT id FROM thresholds WHERE category = ? AND key = ?`,
        [t.category, t.key]
      );

      if (existing) {
        db.run(`
          UPDATE thresholds 
          SET value = ?, label = ?, description = ?, unit = ?, updated_at = ?
          WHERE category = ? AND key = ?
        `, [t.value, t.label, t.description, t.unit, now, t.category, t.key]);
      } else {
        const id = `threshold_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        db.run(`
          INSERT INTO thresholds (id, category, key, value, label, description, unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, t.category, t.key, t.value, t.label, t.description, t.unit, now, now]);
      }
      resetCount++;
    }

    res.json({
      success: true,
      message: `已重置 ${resetCount} 个阈值配置为默认值`,
      resetCount,
      categories: categories || 'all',
    });

  } catch (error) {
    console.error('Error resetting thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

function buildDefaultLabel(category, key) {
  const labelMap = {
    sleep: {
      'target_hours': '目标睡眠时长',
      'min_acceptable': '最低可接受睡眠',
      'consecutive_bad_days': '连续睡眠不足天数',
    },
    heart_rate: {
      'resting_high': '静息心率偏高阈值',
      'resting_low': '静息心率偏低阈值',
      'variability_low': 'HRV 偏低阈值',
    },
    activity: {
      'steps_target': '每日步数目标',
      'steps_low': '步数过低阈值',
      'workout_sudden_increase': '运动量突增比例',
    },
    recovery: {
      'sleep_debt_threshold': '累计睡眠债阈值',
    },
  };

  return labelMap[category]?.[key] || `${category}_${key}`;
}

module.exports = router;
