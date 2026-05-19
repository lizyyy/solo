const express = require('express');
const Joi = require('joi');
const { allQuery, getQuery, runQuery } = require('../config/database');
const { logAudit } = require('../config/logger');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

const alarmSchema = Joi.object({
  alarm_time: Joi.string().required(),
  sensor_id: Joi.string().required(),
  sensor_type: Joi.string().required(),
  alarm_level: Joi.string().valid('低', '中', '高', '紧急').required(),
  alarm_type: Joi.string().required(),
  alarm_value: Joi.number().optional(),
  threshold_value: Joi.number().optional(),
  pump_room_no: Joi.string().required(),
  remarks: Joi.string().optional()
});

router.get('/', requirePermission('alarms:read'), async (req, res) => {
  try {
    const { status, alarm_level, pump_room_no } = req.query;
    let sql = 'SELECT * FROM alarms WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (alarm_level) {
      sql += ' AND alarm_level = ?';
      params.push(alarm_level);
    }
    if (pump_room_no) {
      sql += ' AND pump_room_no = ?';
      params.push(pump_room_no);
    }
    sql += ' ORDER BY alarm_time DESC, id DESC';

    const alarms = await allQuery(sql, params);
    res.json(alarms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requirePermission('alarms:read'), async (req, res) => {
  try {
    const alarm = await getQuery('SELECT * FROM alarms WHERE id = ?', [req.params.id]);
    if (!alarm) {
      return res.status(404).json({ error: '告警记录不存在' });
    }
    res.json(alarm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requirePermission('alarms:create'), async (req, res) => {
  try {
    const { error, value } = alarmSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await runQuery(
      `INSERT INTO alarms (alarm_time, sensor_id, sensor_type, alarm_level, alarm_type, alarm_value, threshold_value, pump_room_no, remarks, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [value.alarm_time, value.sensor_id, value.sensor_type, value.alarm_level, value.alarm_type, 
       value.alarm_value, value.threshold_value, value.pump_room_no, value.remarks, req.user.id]
    );

    await logAudit(req.user.id, req.user.name, '创建告警记录', 'alarms', result.lastID, value);

    const newAlarm = await getQuery('SELECT * FROM alarms WHERE id = ?', [result.lastID]);
    res.status(201).json(newAlarm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/handle', requirePermission('alarms:handle'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    if (!['处理中', '已解决', '误报'].includes(status)) {
      return res.status(400).json({ error: '状态不合法' });
    }

    const alarm = await getQuery('SELECT * FROM alarms WHERE id = ?', [req.params.id]);
    if (!alarm) {
      return res.status(404).json({ error: '告警记录不存在' });
    }

    await runQuery(
      'UPDATE alarms SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.id, req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '处理告警', 'alarms', req.params.id, { status, remarks });

    const updated = await getQuery('SELECT * FROM alarms WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
