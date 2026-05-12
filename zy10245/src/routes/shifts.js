const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../middleware');

router.get('/', (req, res) => {
  const { date, status, type } = req.query;
  let query = 'SELECT * FROM shifts WHERE 1=1';
  const params = [];
  const db = getDb();

  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY date DESC, type DESC';
  const shifts = db.prepare(query).all(...params);
  res.json({ success: true, data: shifts });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) {
    return res.status(404).json({ success: false, error: '班次不存在' });
  }
  res.json({ success: true, data: shift });
});

router.post('/', logOperation('create', 'shift'), (req, res) => {
  const { type, date, nurse_name } = req.body;
  const id = uuidv4();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM shifts WHERE type = ? AND date = ?').get(type, date);
  if (existing) {
    res.locals.blockReason = '该日期同类型班次已存在';
    return res.status(409).json({
      success: false,
      error: '该日期同类型班次已存在',
      existingShift: existing
    });
  }

  db.prepare(`
    INSERT INTO shifts (id, type, date, nurse_name, status)
    VALUES (?, ?, ?, ?, 'scheduled')
  `).run(id, type, date, nurse_name);

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: shift });
});

router.post('/:id/start', logOperation('start', 'shift'), (req, res) => {
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) {
    return res.status(404).json({ success: false, error: '班次不存在' });
  }

  if (shift.status !== 'scheduled') {
    res.locals.blockReason = `班次状态为${shift.status}，无法开始`;
    return res.status(409).json({
      success: false,
      error: `班次状态为${shift.status}，无法开始`
    });
  }

  db.prepare(`
    UPDATE shifts 
    SET status = 'active', started_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  const highRiskElders = db.prepare(`
    SELECT * FROM elders WHERE risk_level IN ('high', 'critical') AND status = 'active'
  `).all();

  highRiskElders.forEach(elder => {
    db.prepare(`
      INSERT INTO risk_alerts (id, elder_id, shift_id, alert_type, message)
      VALUES (?, ?, ?, 'shift_start_risk_reminder', ?)
    `).run(uuidv4(), elder.id, req.params.id, `本班次开始，请重点关注${elder.name}老人（${elder.risk_level}风险）`);
  });

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.post('/:id/handover/submit', logOperation('handover_submit', 'shift'), (req, res) => {
  const { notes, next_shift_id, submitted_by } = req.body;
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);

  if (!shift) {
    return res.status(404).json({ success: false, error: '班次不存在' });
  }

  if (shift.status !== 'active') {
    res.locals.blockReason = `班次状态为${shift.status}，无法提交交接`;
    return res.status(409).json({
      success: false,
      error: `班次状态为${shift.status}，无法提交交接`
    });
  }

  const existingHandover = db.prepare(`
    SELECT * FROM shift_handover WHERE shift_id = ? AND status IN ('submitted', 'acknowledged')
  `).get(req.params.id);

  if (existingHandover) {
    res.locals.blockReason = '该班次已提交交接，请勿重复提交';
    return res.status(409).json({
      success: false,
      error: '该班次已提交交接，请勿重复提交',
      handoverId: existingHandover.id
    });
  }

  const pendingItems = db.prepare(`
    SELECT ci.*, e.name as elder_name FROM care_items ci
    JOIN elders e ON ci.elder_id = e.id
    WHERE ci.status IN ('pending', 'in_progress')
  `).all();

  const highRiskWithoutAlert = db.prepare(`
    SELECT e.* FROM elders e
    LEFT JOIN risk_alerts ra ON e.id = ra.elder_id AND ra.shift_id = ? AND ra.acknowledged = 0
    WHERE e.risk_level IN ('high', 'critical') AND e.status = 'active' AND ra.id IS NULL
  `).all(req.params.id);

  const handoverId = uuidv4();
  db.prepare(`
    INSERT INTO shift_handover (id, shift_id, next_shift_id, submitted_by, notes, status, request_id)
    VALUES (?, ?, ?, ?, ?, 'submitted', ?)
  `).run(handoverId, req.params.id, next_shift_id, submitted_by, notes, req.requestId);

  db.prepare(`
    UPDATE shifts 
    SET status = 'handover_submitted'
    WHERE id = ?
  `).run(req.params.id);

  const handover = db.prepare('SELECT * FROM shift_handover WHERE id = ?').get(handoverId);

  res.json({
    success: true,
    data: handover,
    warnings: {
      pendingCareItems: pendingItems,
      highRiskWithoutAlert: highRiskWithoutAlert
    }
  });
});

router.post('/:id/handover/acknowledge', logOperation('handover_acknowledge', 'shift'), (req, res) => {
  const { acknowledged_by, handover_id } = req.body;
  const db = getDb();

  const handover = db.prepare('SELECT * FROM shift_handover WHERE id = ?').get(handover_id);
  if (!handover) {
    return res.status(404).json({ success: false, error: '交接记录不存在' });
  }

  if (handover.status !== 'submitted') {
    res.locals.blockReason = `交接状态为${handover.status}，无法确认`;
    return res.status(409).json({
      success: false,
      error: `交接状态为${handover.status}，无法确认`
    });
  }

  db.prepare(`
    UPDATE shift_handover 
    SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(acknowledged_by, handover_id);

  db.prepare(`
    UPDATE shifts 
    SET status = 'handover_acknowledged', ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(handover.shift_id);

  if (handover.next_shift_id) {
    db.prepare(`
      UPDATE shifts 
      SET status = 'active', started_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(handover.next_shift_id);
  }

  const updated = db.prepare('SELECT * FROM shift_handover WHERE id = ?').get(handover_id);
  res.json({ success: true, data: updated });
});

router.post('/:id/handover/revoke', logOperation('handover_revoke', 'shift'), (req, res) => {
  const { revoked_by } = req.body;
  const db = getDb();

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) {
    return res.status(404).json({ success: false, error: '班次不存在' });
  }

  const handover = db.prepare(`
    SELECT * FROM shift_handover 
    WHERE shift_id = ? AND status = 'submitted'
  `).get(req.params.id);

  if (!handover) {
    return res.status(404).json({ success: false, error: '未找到可撤销的交接记录' });
  }

  if (handover.status === 'acknowledged') {
    res.locals.blockReason = '交接已被确认，无法撤销';
    return res.status(409).json({
      success: false,
      error: '交接已被确认，无法撤销'
    });
  }

  db.prepare(`
    UPDATE shift_handover 
    SET status = 'revoked'
    WHERE id = ?
  `).run(handover.id);

  db.prepare(`
    UPDATE shifts 
    SET status = 'active'
    WHERE id = ?
  `).run(req.params.id);

  res.json({ success: true, message: '交接已撤销' });
});

router.get('/:id/handover', (req, res) => {
  const db = getDb();
  const handover = db.prepare(`
    SELECT sh.*, s1.nurse_name as outgoing_nurse, s2.nurse_name as incoming_nurse
    FROM shift_handover sh
    JOIN shifts s1 ON sh.shift_id = s1.id
    LEFT JOIN shifts s2 ON sh.next_shift_id = s2.id
    WHERE sh.shift_id = ?
    ORDER BY sh.created_at DESC
    LIMIT 1
  `).get(req.params.id);

  if (!handover) {
    return res.status(404).json({ success: false, error: '交接记录不存在' });
  }

  res.json({ success: true, data: handover });
});

router.get('/:id/risk-alerts', (req, res) => {
  const { acknowledged } = req.query;
  const db = getDb();
  let query = 'SELECT * FROM risk_alerts WHERE shift_id = ?';
  const params = [req.params.id];

  if (acknowledged !== undefined) {
    query += ' AND acknowledged = ?';
    params.push(acknowledged === 'true' ? 1 : 0);
  }

  const alerts = db.prepare(query).all(...params);
  res.json({ success: true, data: alerts });
});

router.post('/risk-alerts/:id/acknowledge', logOperation('acknowledge_alert', 'risk_alert'), (req, res) => {
  const { acknowledged_by } = req.body;
  const db = getDb();

  db.prepare(`
    UPDATE risk_alerts 
    SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(acknowledged_by, req.params.id);

  res.json({ success: true, message: '提醒已确认' });
});

module.exports = router;
