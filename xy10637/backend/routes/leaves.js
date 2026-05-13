const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateId, addTimeLine, addAuditLog } = require('../utils/helpers');
const rulesEngine = require('../services/rulesEngine');

router.get('/', (req, res) => {
  const sql = `SELECT l.*, c.name as caregiver_name 
                FROM leave_records l
                LEFT JOIN caregivers c ON l.caregiver_id = c.id
                ORDER BY l.start_time DESC`;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  const sql = `SELECT l.*, c.name as caregiver_name 
                FROM leave_records l
                LEFT JOIN caregivers c ON l.caregiver_id = c.id
                WHERE l.id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '请假记录不存在' });
    } else {
      res.json(row);
    }
  });
});

router.post('/', async (req, res) => {
  const { caregiver_id, schedule_id, leave_type, start_time, end_time, reason } = req.body;
  const id = generateId();

  const validation = await rulesEngine.validateLeave(caregiver_id, start_time, end_time);
  
  if (!validation.valid) {
    return res.status(400).json({ error: '请假验证失败', errors: validation.errors, warnings: validation.warnings });
  }

  const sql = `INSERT INTO leave_records (id, caregiver_id, schedule_id, leave_type, start_time, end_time, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, caregiver_id, schedule_id, leave_type, start_time, end_time, reason, 'pending'], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('leave', id, 'create', `申请${leave_type}请假：${start_time} 至 ${end_time}`);
      await addAuditLog('leave_records', id, 'insert', null, { caregiver_id, leave_type, start_time, end_time });
      res.json({ id, caregiver_id, leave_type, overlapping_schedules: validation.overlappingSchedules });
    }
  });
});

router.put('/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  
  db.get('SELECT * FROM leave_records WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRow) {
      res.status(404).json({ error: '请假记录不存在' });
      return;
    }

    const sql = `UPDATE leave_records SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;
    db.run(sql, ['approved', approved_by, req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        await addTimeLine('leave', req.params.id, 'approve', `请假已批准`, { status: oldRow.status }, { status: 'approved' });
        await addAuditLog('leave_records', req.params.id, 'update', oldRow, { status: 'approved', approved_by });
        res.json({ success: true });
      }
    });
  });
});

router.put('/:id/reject', (req, res) => {
  const { approved_by, remarks } = req.body;
  
  db.get('SELECT * FROM leave_records WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRow) {
      res.status(404).json({ error: '请假记录不存在' });
      return;
    }

    const sql = `UPDATE leave_records SET status = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;
    db.run(sql, ['rejected', req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        await addTimeLine('leave', req.params.id, 'reject', `请假已驳回`, { status: oldRow.status }, { status: 'rejected' });
        await addAuditLog('leave_records', req.params.id, 'update', oldRow, { status: 'rejected' });
        res.json({ success: true });
      }
    });
  });
});

module.exports = router;