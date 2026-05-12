const express = require('express');
const router = express.Router();
const service = require('../services/schedulingService');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/nannies', (req, res) => {
  const result = service.createNanny(req.body, getOperator(req));
  res.json(result);
});

router.get('/nannies', (req, res) => {
  res.json(service.getAllNannies());
});

router.post('/skills', (req, res) => {
  res.json(service.createSkill(req.body, getOperator(req)));
});

router.get('/skills', (req, res) => {
  res.json(service.getAllSkills());
});

router.post('/orders', (req, res) => {
  const result = service.createOrder(req.body, getOperator(req));
  res.json(result);
});

router.get('/orders', (req, res) => {
  res.json(service.getAllOrders());
});

router.post('/schedules', (req, res) => {
  const { orderId, idempotentKey } = req.body;
  const result = service.createSchedule(orderId, getOperator(req), idempotentKey);
  res.json(result);
});

router.get('/schedules/:id', (req, res) => {
  res.json(service.getSchedule(req.params.id));
});

router.post('/schedules/:id/advance', (req, res) => {
  const { targetStatus, idempotentKey, reason } = req.body;
  const result = service.advanceSchedule(
    req.params.id, 
    targetStatus, 
    getOperator(req), 
    { idempotentKey, reason }
  );
  res.json(result);
});

router.post('/schedules/:id/reassign', (req, res) => {
  const { idempotentKey } = req.body;
  const result = service.reassignSchedule(
    req.params.id, 
    getOperator(req), 
    { idempotentKey }
  );
  res.json(result);
});

router.post('/schedules/:id/manual-correct', (req, res) => {
  const { newNannyId, reason } = req.body;
  const result = service.manualCorrect(
    req.params.id, 
    newNannyId, 
    getOperator(req), 
    reason
  );
  res.json(result);
});

router.get('/schedules/daily/:date', (req, res) => {
  res.json(service.getDailySchedules(req.params.date));
});

router.post('/leaves', (req, res) => {
  res.json(service.createLeave(req.body, getOperator(req)));
});

router.post('/leaves/:id/approve', (req, res) => {
  res.json(service.approveLeave(req.params.id, getOperator(req)));
});

router.get('/leaves', (req, res) => {
  res.json(service.getAllLeaves());
});

router.get('/compensations', (req, res) => {
  res.json(service.getAllCompensations());
});

router.get('/orders/:id/reassign-history', (req, res) => {
  res.json(service.getReassignHistory(req.params.id));
});

router.get('/orders/:id/customer-impact', (req, res) => {
  res.json(service.getCustomerImpact(req.params.id));
});

router.get('/reports/daily/:date', (req, res) => {
  res.json(service.exportReport(req.params.date));
});

router.get('/audit-logs', (req, res) => {
  const { entityType, entityId } = req.query;
  res.json(service.getAuditLogs(entityType, entityId));
});

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

module.exports = router;
