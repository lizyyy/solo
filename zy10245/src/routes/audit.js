const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/operation-logs', (req, res) => {
  const { entity_type, status, limit = 50 } = req.query;
  let query = 'SELECT * FROM operation_logs WHERE 1=1';
  const params = [];
  const db = getDb();

  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const logs = db.prepare(query).all(...params);
  res.json({ success: true, data: logs });
});

router.get('/blocked-operations', (req, res) => {
  const { entity_type } = req.query;
  let query = `
    SELECT * FROM operation_logs 
    WHERE status = 'blocked'
  `;
  const params = [];
  const db = getDb();

  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }

  query += ' ORDER BY created_at DESC';
  const logs = db.prepare(query).all(...params);

  res.json({
    success: true,
    data: logs,
    summary: {
      total: logs.length,
      byReason: logs.reduce((acc, log) => {
        acc[log.block_reason] = (acc[log.block_reason] || 0) + 1;
        return acc;
      }, {})
    }
  });
});

router.get('/pending-items-summary', (req, res) => {
  const db = getDb();
  const pendingItems = db.prepare(`
    SELECT ci.*, e.name as elder_name, e.risk_level, e.room_number
    FROM care_items ci
    JOIN elders e ON ci.elder_id = e.id
    WHERE ci.status IN ('pending', 'in_progress')
    ORDER BY e.risk_level DESC, ci.created_at ASC
  `).all();

  const byRiskLevel = pendingItems.reduce((acc, item) => {
    acc[item.risk_level] = (acc[item.risk_level] || 0) + 1;
    return acc;
  }, {});

  const byType = pendingItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: pendingItems,
    summary: {
      total: pendingItems.length,
      byRiskLevel,
      byType
    }
  });
});

router.get('/handover-history', (req, res) => {
  const { start_date, end_date, shift_type } = req.query;
  let query = `
    SELECT 
      sh.*,
      s1.type as shift_type,
      s1.date as shift_date,
      s1.nurse_name as outgoing_nurse,
      s2.nurse_name as incoming_nurse,
      s1.started_at as shift_started,
      s1.ended_at as shift_ended
    FROM shift_handover sh
    JOIN shifts s1 ON sh.shift_id = s1.id
    LEFT JOIN shifts s2 ON sh.next_shift_id = s2.id
    WHERE sh.status = 'acknowledged'
  `;
  const params = [];
  const db = getDb();

  if (start_date) {
    query += ' AND s1.date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND s1.date <= ?';
    params.push(end_date);
  }
  if (shift_type) {
    query += ' AND s1.type = ?';
    params.push(shift_type);
  }

  query += ' ORDER BY s1.date DESC, s1.type DESC';
  const history = db.prepare(query).all(...params);

  res.json({
    success: true,
    data: history,
    total: history.length
  });
});

router.get('/risk-alerts-summary', (req, res) => {
  const { shift_id } = req.query;
  let query = `
    SELECT 
      ra.*,
      e.name as elder_name,
      e.room_number
    FROM risk_alerts ra
    JOIN elders e ON ra.elder_id = e.id
    WHERE 1=1
  `;
  const params = [];
  const db = getDb();

  if (shift_id) {
    query += ' AND ra.shift_id = ?';
    params.push(shift_id);
  }

  query += ' ORDER BY ra.created_at DESC';
  const alerts = db.prepare(query).all(...params);

  const unacknowledged = alerts.filter(a => !a.acknowledged);

  res.json({
    success: true,
    data: alerts,
    summary: {
      total: alerts.length,
      unacknowledged: unacknowledged.length,
      byType: alerts.reduce((acc, alert) => {
        acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
        return acc;
      }, {})
    }
  });
});

module.exports = router;
