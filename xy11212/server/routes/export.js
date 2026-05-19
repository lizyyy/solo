const express = require('express');
const { Parser } = require('json2csv');
const { allQuery } = require('../config/database');
const { logAudit, maskSensitiveData } = require('../config/logger');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/inspections', requirePermission('export:inspection'), async (req, res) => {
  try {
    const { status, pump_room_no, start_date, end_date, format = 'json' } = req.query;
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
    sql += ' ORDER BY inspection_date DESC';

    let inspections = await allQuery(sql, params);
    inspections = maskSensitiveData(inspections);

    await logAudit(req.user.id, req.user.name, '导出巡检记录', 'export', null, { count: inspections.length, format });

    if (format === 'csv') {
      const fields = ['id', 'inspection_date', 'inspector_name', 'pump_room_no', 'water_pressure', 'water_level', 'pump_status', 'power_status', 'temperature', 'humidity', 'remarks', 'status', 'created_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(inspections);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="inspections_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } else {
      res.json(inspections);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alarms', requirePermission('export:alarm'), async (req, res) => {
  try {
    const { status, alarm_level, pump_room_no, format = 'json' } = req.query;
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
    sql += ' ORDER BY alarm_time DESC';

    let alarms = await allQuery(sql, params);
    alarms = maskSensitiveData(alarms);

    await logAudit(req.user.id, req.user.name, '导出告警记录', 'export', null, { count: alarms.length, format });

    if (format === 'csv') {
      const fields = ['id', 'alarm_time', 'sensor_id', 'sensor_type', 'alarm_level', 'alarm_type', 'alarm_value', 'threshold_value', 'pump_room_no', 'status', 'remarks', 'created_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(alarms);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="alarms_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } else {
      res.json(alarms);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/work-orders', requirePermission('export:workOrder'), async (req, res) => {
  try {
    const { status, priority, pump_room_no, format = 'json' } = req.query;
    let sql = 'SELECT * FROM work_orders WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    if (pump_room_no) {
      sql += ' AND pump_room_no = ?';
      params.push(pump_room_no);
    }
    sql += ' ORDER BY created_at DESC';

    let workOrders = await allQuery(sql, params);
    workOrders = maskSensitiveData(workOrders);

    await logAudit(req.user.id, req.user.name, '导出工单记录', 'export', null, { count: workOrders.length, format });

    if (format === 'csv') {
      const fields = ['id', 'order_no', 'type', 'title', 'description', 'pump_room_no', 'priority', 'status', 'reporter_name', 'reporter_phone', 'assigned_to', 'created_at', 'closed_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(workOrders);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="work-orders_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } else {
      res.json(workOrders);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', requirePermission('export:audit'), async (req, res) => {
  try {
    const { user_id, action, resource_type, format = 'json' } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(user_id);
    }
    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (resource_type) {
      sql += ' AND resource_type = ?';
      params.push(resource_type);
    }
    sql += ' ORDER BY created_at DESC';

    let logs = await allQuery(sql, params);
    logs = maskSensitiveData(logs);

    await logAudit(req.user.id, req.user.name, '导出审计日志', 'export', null, { count: logs.length, format });

    if (format === 'csv') {
      const fields = ['id', 'user_id', 'user_name', 'action', 'resource_type', 'resource_id', 'details', 'created_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(logs);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } else {
      res.json(logs);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
