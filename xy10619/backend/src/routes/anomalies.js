const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  const { isResolved, severity, recordType } = req.query;
  let query = `
    SELECT a.*, s.name as resolved_by_name
    FROM anomalies a
    LEFT JOIN staff s ON a.resolved_by = s.id
    WHERE 1=1
  `;
  const params = [];

  if (isResolved !== undefined) {
    query += ' AND a.is_resolved = ?';
    params.push(isResolved);
  }
  if (severity) {
    query += ' AND a.severity = ?';
    params.push(severity);
  }
  if (recordType) {
    query += ' AND a.record_type = ?';
    params.push(recordType);
  }

  query += ' ORDER BY a.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.put('/:id/resolve', (req, res) => {
  const { resolvedBy, remarks } = req.body;
  
  db.run(`
    UPDATE anomalies 
    SET is_resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [resolvedBy, req.params.id], function(err) {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, message: '异常已解决', changes: this.changes });
    }
  });
});

router.post('/check', (req, res) => {
  const { borrowRecordId } = req.body;
  const anomalies = [];

  db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowRecordId], (err, borrow) => {
    if (!borrow) {
      return res.json({ success: true, data: [] });
    }

    if (borrow.is_overdue && borrow.damage_level_id) {
      anomalies.push({
        record_type: 'borrow',
        record_id: borrowRecordId,
        anomaly_type: 'overdue_damage',
        description: '该借阅同时存在逾期和破损情况',
        severity: 'high',
        is_resolved: 0
      });
    }

    if (borrow.overdue_days > 30) {
      anomalies.push({
        record_type: 'borrow',
        record_id: borrowRecordId,
        anomaly_type: 'long_overdue',
        description: `逾期超过30天（${borrow.overdue_days}天）`,
        severity: 'high',
        is_resolved: 0
      });
    }

    if (anomalies.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO anomalies (record_type, record_id, anomaly_type, description, severity, is_resolved)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      anomalies.forEach(a => {
        stmt.run(a.record_type, a.record_id, a.anomaly_type, a.description, a.severity, a.is_resolved);
      });
      stmt.finalize();
    }

    res.json({ success: true, data: anomalies });
  });
});

module.exports = router;
