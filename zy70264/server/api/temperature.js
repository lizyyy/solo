const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const CompensationEngine = require('../services/compensationEngine');

router.get('/batch/:batchId', (req, res) => {
  const segments = db.prepare(`
    SELECT * FROM temperature_segments 
    WHERE batch_id = ? 
    ORDER BY start_time
  `).all(req.params.batchId);

  const segmentsWithCheck = segments.map(segment => {
    const check = CompensationEngine.checkTemperatureAbnormality(segment);
    return {
      ...segment,
      temp_records: JSON.parse(segment.temp_records || '[]'),
      check_result: check
    };
  });

  res.json({ success: true, data: segmentsWithCheck });
});

router.post('/', (req, res) => {
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const {
    batch_id, segment_name, start_time, end_time,
    avg_temp, min_temp, max_temp, temp_records
  } = req.body;

  if (!batch_id || !segment_name || !start_time) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const records = temp_records || [];
  const temps = records.map(r => r.temperature).filter(t => !isNaN(t));
  
  const computedAvg = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : avg_temp;
  const computedMin = temps.length > 0 ? Math.min(...temps) : min_temp;
  const computedMax = temps.length > 0 ? Math.max(...temps) : max_temp;

  const check = CompensationEngine.checkTemperatureAbnormality({
    temp_records: JSON.stringify(records)
  });

  try {
    db.prepare(`
      INSERT INTO temperature_segments (
        id, batch_id, segment_name, start_time, end_time,
        avg_temp, min_temp, max_temp, temp_records,
        is_normal, abnormal_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      batch_id,
      segment_name,
      start_time,
      end_time || null,
      computedAvg,
      computedMin,
      computedMax,
      JSON.stringify(records),
      check.abnormal ? 0 : 1,
      check.abnormal ? check.reason : null,
      now
    );

    res.json({ success: true, data: { id, check } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  const segment = db.prepare('SELECT * FROM temperature_segments WHERE id = ?').get(req.params.id);
  if (!segment) {
    return res.status(404).json({ success: false, message: '温度片段不存在' });
  }

  const updates = [];
  const values = [];

  Object.keys(req.body).forEach(key => {
    if (['segment_name', 'start_time', 'end_time'].includes(key)) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  });

  if (req.body.temp_records) {
    const records = req.body.temp_records;
    const temps = records.map(r => r.temperature).filter(t => !isNaN(t));
    
    if (temps.length > 0) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      
      updates.push('avg_temp = ?, min_temp = ?, max_temp = ?, temp_records = ?');
      values.push(avg, min, max, JSON.stringify(records));

      const check = CompensationEngine.checkTemperatureAbnormality({
        temp_records: JSON.stringify(records)
      });
      updates.push('is_normal = ?, abnormal_reason = ?');
      values.push(check.abnormal ? 0 : 1, check.abnormal ? check.reason : null);
    }
  }

  if (updates.length === 0) {
    return res.json({ success: true, message: '没有需要更新的字段' });
  }

  values.push(req.params.id);

  try {
    db.prepare(`UPDATE temperature_segments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM temperature_segments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/generate-normal', (req, res) => {
  const { batch_id, segment_name, count = 20 } = req.body;
  
  if (!batch_id || !segment_name) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const records = [];
  const baseTime = dayjs();
  
  for (let i = 0; i < count; i++) {
    records.push({
      time: baseTime.add(i * 3, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      temperature: 65 + Math.random() * 10
    });
  }

  res.json({
    success: true,
    data: {
      segment_name,
      start_time: records[0].time,
      end_time: records[records.length - 1].time,
      temp_records: records
    }
  });
});

router.post('/generate-abnormal', (req, res) => {
  const { batch_id, segment_name, count = 20, abnormal_type = 'low' } = req.body;
  
  if (!batch_id || !segment_name) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const records = [];
  const baseTime = dayjs();
  
  for (let i = 0; i < count; i++) {
    let temp;
    if (abnormal_type === 'low') {
      temp = i > 8 ? 40 + Math.random() * 10 : 65 + Math.random() * 10;
    } else if (abnormal_type === 'high') {
      temp = i > 8 ? 90 + Math.random() * 5 : 65 + Math.random() * 10;
    } else {
      temp = i % 3 === 0 ? 40 + Math.random() * 5 : 65 + Math.random() * 10;
    }
    
    records.push({
      time: baseTime.add(i * 3, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      temperature: temp
    });
  }

  res.json({
    success: true,
    data: {
      segment_name,
      start_time: records[0].time,
      end_time: records[records.length - 1].time,
      temp_records: records
    }
  });
});

module.exports = router;
