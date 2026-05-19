const express = require('express');
const Joi = require('joi');
const { allQuery, getQuery, runQuery } = require('../config/database');
const { logAudit } = require('../config/logger');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

const inspectionSchema = Joi.object({
  inspection_date: Joi.string().required(),
  inspector_name: Joi.string().required(),
  pump_room_no: Joi.string().required(),
  water_pressure: Joi.number().optional(),
  water_level: Joi.number().optional(),
  pump_status: Joi.string().valid('正常', '故障', '维护中').optional(),
  power_status: Joi.string().valid('正常', '断电', '异常').optional(),
  temperature: Joi.number().optional(),
  humidity: Joi.number().optional(),
  remarks: Joi.string().optional()
});

router.get('/', requirePermission('inspections:read'), async (req, res) => {
  try {
    const { status, pump_room_no, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM inspections WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (pump_room_no) {
      sql += ' AND pump_room_no = ?';
      params.push(pump_room_no);
    }
    if (start_date) {
      sql += ' AND inspection_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND inspection_date <= ?';
      params.push(end_date);
    }
    sql += ' ORDER BY inspection_date DESC, id DESC';

    const inspections = await allQuery(sql, params);
    res.json(inspections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requirePermission('inspections:read'), async (req, res) => {
  try {
    const inspection = await getQuery('SELECT * FROM inspections WHERE id = ?', [req.params.id]);
    if (!inspection) {
      return res.status(404).json({ error: '巡检记录不存在' });
    }
    res.json(inspection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requirePermission('inspections:create'), async (req, res) => {
  try {
    const { error, value } = inspectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await runQuery(
      `INSERT INTO inspections (inspection_date, inspector_name, pump_room_no, water_pressure, water_level, pump_status, power_status, temperature, humidity, remarks, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [value.inspection_date, value.inspector_name, value.pump_room_no, value.water_pressure, value.water_level, 
       value.pump_status, value.power_status, value.temperature, value.humidity, value.remarks, req.user.id]
    );

    await logAudit(req.user.id, req.user.name, '创建巡检记录', 'inspections', result.lastID, value);

    const newInspection = await getQuery('SELECT * FROM inspections WHERE id = ?', [result.lastID]);
    res.status(201).json(newInspection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/review', requirePermission('inspections:review'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    if (!['已通过', '需整改'].includes(status)) {
      return res.status(400).json({ error: '状态必须是已通过或需整改' });
    }

    const inspection = await getQuery('SELECT * FROM inspections WHERE id = ?', [req.params.id]);
    if (!inspection) {
      return res.status(404).json({ error: '巡检记录不存在' });
    }

    await runQuery(
      'UPDATE inspections SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.id, req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '复核巡检记录', 'inspections', req.params.id, { status, remarks });

    const updated = await getQuery('SELECT * FROM inspections WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
