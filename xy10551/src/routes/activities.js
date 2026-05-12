const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');
const service = require('../services/registrationService');

router.get('/', (req, res) => {
  const activities = db.prepare('SELECT * FROM activities ORDER BY start_time DESC').all();
  res.json({ success: true, data: activities });
});

router.get('/:id', (req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return res.status(404).json({ success: false, error: '活动不存在' });
  res.json({ success: true, data: activity });
});

router.post('/', (req, res) => {
  const { name, description, start_time, end_time, location, max_participants, min_age, max_age, max_per_family, created_by } = req.body;
  
  if (!name || !start_time || !max_participants) {
    return res.status(400).json({ success: false, error: '缺少必要字段：name, start_time, max_participants' });
  }
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO activities (id, name, description, start_time, end_time, location, max_participants, min_age, max_age, max_per_family, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  
  stmt.run(id, name, description || null, start_time, end_time || null, location || null, 
            max_participants, min_age || null, max_age || null, max_per_family || null, created_by || 'admin');
  
  service.logAudit('activity', id, 'created', null, {
    name, start_time, max_participants, min_age, max_age, max_per_family
  }, created_by || 'admin', '创建活动');
  
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: activity, message: '活动创建成功' });
});

router.post('/:id/progress', (req, res) => {
  const { status, operator } = req.body;
  const activityId = req.params.id;
  
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!activity) return res.status(404).json({ success: false, error: '活动不存在' });
  
  const validStatuses = ['active', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: '无效的状态值' });
  }
  
  const beforeData = { ...activity };
  
  db.prepare(`UPDATE activities SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, activityId);
  
  service.logAudit('activity', activityId, 'status_changed', beforeData, { status }, operator || 'admin', `活动状态变更为 ${status}`);
  
  res.json({ success: true, message: `活动状态已更新为 ${status}` });
});

router.get('/:id/registrations', (req, res) => {
  const participants = service.getActivityParticipants(req.params.id);
  res.json({ success: true, data: participants });
});

router.get('/:id/waitlist', (req, res) => {
  const waitlist = service.getActivityWaitlist(req.params.id);
  res.json({ success: true, data: waitlist });
});

router.get('/:id/report', (req, res) => {
  const report = service.getActivityReport(req.params.id);
  if (!report.success) return res.status(404).json(report);
  
  if (req.query.export === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename=activity-${req.params.id}-report.json`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(report, null, 2));
  }
  
  res.json(report);
});

router.post('/:id/register', (req, res) => {
  const { residentId, familyMemberIds, operator, requestId } = req.body;
  
  if (!residentId) {
    return res.status(400).json({ success: false, error: '缺少 residentId' });
  }
  
  const result = service.registerForActivity({
    activityId: req.params.id,
    residentId,
    familyMemberIds: familyMemberIds || [],
    operator,
    requestId
  });
  
  if (!result.success && !result.idempotent) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/registrations/:registrationId/cancel', (req, res) => {
  const { operator, reason, requestId } = req.body;
  
  const result = service.cancelRegistration({
    registrationId: req.params.registrationId,
    operator,
    reason,
    requestId
  });
  
  if (!result.success && !result.idempotent && result.code === 'REGISTRATION_NOT_FOUND') {
    return res.status(404).json(result);
  }
  
  if (!result.success && !result.idempotent) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/waitlist/:waitlistId/cancel', (req, res) => {
  const { operator, reason, requestId } = req.body;
  
  const result = service.cancelWaitlist({
    waitlistId: req.params.waitlistId,
    operator,
    reason,
    requestId
  });
  
  if (!result.success && !result.idempotent && result.code === 'WAITLIST_NOT_FOUND') {
    return res.status(404).json(result);
  }
  
  res.json(result);
});

router.post('/registrations/:registrationId/checkin', (req, res) => {
  const { operator, requestId } = req.body;
  
  const result = service.checkIn({
    registrationId: req.params.registrationId,
    operator,
    requestId
  });
  
  if (!result.success && !result.idempotent && result.code === 'REGISTRATION_NOT_FOUND') {
    return res.status(404).json(result);
  }
  
  if (!result.success && !result.idempotent) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:id/manual-correction', (req, res) => {
  const { entityType, entityId, updates, operator, reason } = req.body;
  
  const result = service.manualCorrection({
    entityType,
    entityId,
    updates,
    operator,
    reason,
    requestId: req.headers['x-request-id']
  });
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.get('/:id/audit-log', (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE entity_type IN ('activity', 'registration', 'waitlist') 
    AND (entity_id = ? OR (entity_type = 'activity' AND entity_id = ?))
    ORDER BY created_at ASC
  `).all(req.params.id, req.params.id);
  
  res.json({ success: true, data: logs });
});

module.exports = router;
