const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const store = require('../storage/memoryStore');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

router.post('/services', (req, res) => {
  try {
    const { id, name, description } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: '缺少必要字段: id, name' });
    }
    const service = notificationService.createOrRegisterService(id, name, description);
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/services', (req, res) => {
  res.json(store.getAllServices());
});

router.get('/services/:serviceId', (req, res) => {
  const service = store.getService(req.params.serviceId);
  if (!service) {
    return res.status(404).json({ error: '服务不存在' });
  }
  res.json(service);
});

router.post('/rules', (req, res) => {
  try {
    const { serviceId, tenantId } = req.body;
    if (!serviceId || !tenantId) {
      return res.status(400).json({ error: '缺少必要字段: serviceId, tenantId' });
    }
    const rule = notificationService.setTenantRule(req.body);
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rules/:serviceId/:tenantId', (req, res) => {
  const rule = notificationService.getTenantRule(req.params.serviceId, req.params.tenantId);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在' });
  }
  res.json(rule);
});

router.get('/rules/:serviceId', (req, res) => {
  const rules = store.getServiceRules(req.params.serviceId);
  res.json(rules);
});

router.post('/notifications', (req, res) => {
  try {
    const result = notificationService.processIncomingNotification(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/notifications/:groupId/confirm', (req, res) => {
  try {
    const { confirmedBy } = req.body;
    const group = notificationService.confirmNotification(req.params.groupId, confirmedBy);
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/notifications/:groupId/close', (req, res) => {
  try {
    const { closedBy } = req.body;
    const group = notificationService.closeNotification(req.params.groupId, closedBy);
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/notifications/active', (req, res) => {
  const { serviceId, tenantId } = req.query;
  const groups = notificationService.getActiveGroups(serviceId, tenantId);
  res.json(groups);
});

router.get('/notifications/:groupId', (req, res) => {
  const detail = notificationService.getNotificationGroupDetail(req.params.groupId);
  if (!detail) {
    return res.status(404).json({ error: '通知组不存在' });
  }
  res.json(detail);
});

router.get('/history', (req, res) => {
  const { serviceId, tenantId } = req.query;
  const history = notificationService.getSendHistory(serviceId, tenantId);
  res.json(history);
});

router.get('/reports/noise-reduction', (req, res) => {
  const { timeRangeMinutes = 1440 } = req.query;
  const report = notificationService.generateNoiseReductionReport(
    parseInt(timeRangeMinutes, 10)
  );
  res.json(report);
});

module.exports = router;
