const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../config/database');
const { generateId, addTimeLine, addAuditLog, getShiftHours } = require('../utils/helpers');
const rulesEngine = require('../services/rulesEngine');

router.get('/', (req, res) => {
  const sql = `SELECT s.*, c.name as caregiver_name, w.name as ward_name 
                FROM schedules s
                LEFT JOIN caregivers c ON s.caregiver_id = c.id
                LEFT JOIN ward_demands wd ON s.ward_demand_id = wd.id
                LEFT JOIN wards w ON wd.ward_id = w.id
                ORDER BY s.date DESC, s.created_at DESC`;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  const sql = `SELECT s.*, c.name as caregiver_name, w.name as ward_name 
                FROM schedules s
                LEFT JOIN caregivers c ON s.caregiver_id = c.id
                LEFT JOIN ward_demands wd ON s.ward_demand_id = wd.id
                LEFT JOIN wards w ON wd.ward_id = w.id
                WHERE s.id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '排班不存在' });
    } else {
      res.json(row);
    }
  });
});

router.post('/', async (req, res) => {
  const { ward_demand_id, caregiver_id, date, shift_type, remarks } = req.body;
  const id = generateId();

  const validation = await rulesEngine.validateSchedule(caregiver_id, ward_demand_id, date, shift_type);
  
  if (!validation.valid) {
    return res.status(400).json({ error: '排班验证失败', errors: validation.errors, warnings: validation.warnings });
  }

  const shiftHours = getShiftHours(shift_type);
  const startTime = moment(`${date} ${shiftHours.start}`).format('YYYY-MM-DD HH:mm:ss');
  const endTime = shiftHours.end === '00:00' 
    ? moment(date).add(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss')
    : moment(`${date} ${shiftHours.end}`).format('YYYY-MM-DD HH:mm:ss');

  const sql = `INSERT INTO schedules (id, ward_demand_id, caregiver_id, date, shift_type, start_time, end_time, actual_hours, status, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, ward_demand_id, caregiver_id, date, shift_type, startTime, endTime, shiftHours.hours, 'scheduled', remarks], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('schedule', id, 'create', `创建排班：${date} ${shift_type} - ${validation.caregiver.name}`);
      await addAuditLog('schedules', id, 'insert', null, { caregiver_id, date, shift_type });
      res.json({ id, caregiver_id, date, shift_type, warnings: validation.warnings });
    }
  });
});

router.put('/:id/status', async (req, res) => {
  const { status, remarks } = req.body;
  
  db.get('SELECT * FROM schedules WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRow) {
      res.status(404).json({ error: '排班不存在' });
      return;
    }

    const sql = 'UPDATE schedules SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [status, remarks, req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const statusDesc = {
          'scheduled': '已排班',
          'in_progress': '进行中',
          'completed': '已完成',
          'cancelled': '已取消'
        };
        await addTimeLine('schedule', req.params.id, 'status_change', `排班状态变更为：${statusDesc[status] || status}`, { status: oldRow.status }, { status });
        await addAuditLog('schedules', req.params.id, 'update', oldRow, { status });
        res.json({ success: true });
      }
    });
  });
});

router.put('/:id', async (req, res) => {
  const { caregiver_id, date, shift_type, remarks } = req.body;
  
  db.get('SELECT * FROM schedules WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRow) {
      res.status(404).json({ error: '排班不存在' });
      return;
    }

    const validation = await rulesEngine.validateSchedule(
      caregiver_id,
      oldRow.ward_demand_id,
      date,
      shift_type,
      req.params.id
    );

    if (!validation.valid) {
      return res.status(400).json({ error: '排班验证失败', errors: validation.errors, warnings: validation.warnings });
    }

    const shiftHours = getShiftHours(shift_type);
    const startTime = moment(`${date} ${shiftHours.start}`).format('YYYY-MM-DD HH:mm:ss');
    const endTime = shiftHours.end === '00:00' 
      ? moment(date).add(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss')
      : moment(`${date} ${shiftHours.end}`).format('YYYY-MM-DD HH:mm:ss');

    const sql = `UPDATE schedules SET caregiver_id = ?, date = ?, shift_type = ?, start_time = ?, end_time = ?, actual_hours = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;
    db.run(sql, [caregiver_id, date, shift_type, startTime, endTime, shiftHours.hours, remarks, req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        await addTimeLine('schedule', req.params.id, 'update', `修改排班信息', oldRow, { caregiver_id, date, shift_type });
        await addAuditLog('schedules', req.params.id, 'update', oldRow, { caregiver_id, date, shift_type });
        res.json({ success: true, warnings: validation.warnings });
      }
    });
  });
});

module.exports = router;