const express = require('express');
const router = express.Router();
const diagnostic = require('../services/diagnostic');
const storage = require('../services/storage');

router.get('/queues/:queueName/diagnosis', (req, res) => {
  const { queueName } = req.params;
  const { consumerGroupId } = req.query;
  if (!consumerGroupId) {
    return res.status(400).json({ error: '缺少必需参数: consumerGroupId' });
  }
  const result = diagnostic.analyze(queueName, consumerGroupId);
  res.json(result);
});

router.post('/queues/:queueName/diagnosis/generate-alert', (req, res) => {
  const { queueName } = req.params;
  const { consumerGroupId } = req.body;
  if (!consumerGroupId) {
    return res.status(400).json({ error: '缺少必需参数: consumerGroupId' });
  }
  const result = diagnostic.analyze(queueName, consumerGroupId);
  const activeAlerts = storage.getActiveAlerts(queueName);
  if (!diagnostic.shouldGenerateAlert(result)) {
    if (activeAlerts.length > 0) {
      activeAlerts.forEach(alert => storage.resolveAlert(alert.id));
      return res.json({
        status: 'resolved',
        message: '队列状态恢复正常，告警已自动恢复',
        diagnosis: result,
        resolvedAlerts: activeAlerts.length
      });
    }
    return res.json({
      status: 'normal',
      message: '队列状态正常，无需告警',
      diagnosis: result
    });
  }
  const acknowledgedAlerts = storage.getAlerts(queueName).filter(a => a.status === 'acknowledged');
  let reopened = null;
  for (const alert of acknowledgedAlerts) {
    if (diagnostic.shouldReopenAlert(alert, result)) {
      reopened = storage.reopenAlert(alert.id);
      break;
    }
  }
  if (reopened) {
    return res.json({
      status: 'reopened',
      message: '告警已确认但状况持续恶化，重新打开',
      alert: reopened,
      diagnosis: result
    });
  }
  if (activeAlerts.length === 0) {
    const newAlert = storage.createAlert({
      queueName,
      consumerGroupId,
      severity: result.status,
      diagnosis: result,
      rootCauses: result.rootCauses.map(rc => rc.cause),
      description: result.overallDescription
    });
    return res.json({
      status: 'created',
      message: '检测到异常，创建新告警',
      alert: newAlert,
      diagnosis: result
    });
  }
  return res.json({
    status: 'existing',
    message: '已有活跃告警',
    alerts: activeAlerts,
    diagnosis: result
  });
});

router.get('/alerts', (req, res) => {
  const { queueName, status } = req.query;
  let alerts = storage.getAlerts(queueName);
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }
  res.json({ alerts });
});

router.get('/alerts/:alertId', (req, res) => {
  const { alertId } = req.params;
  const alert = storage.getAlert(alertId);
  if (!alert) {
    return res.status(404).json({ error: '告警不存在' });
  }
  res.json(alert);
});

router.post('/alerts/:alertId/acknowledge', (req, res) => {
  const { alertId } = req.params;
  const alert = storage.acknowledgeAlert(alertId);
  if (!alert) {
    return res.status(404).json({ error: '告警不存在' });
  }
  res.json({
    message: '告警已确认',
    alert
  });
});

router.post('/alerts/:alertId/resolve', (req, res) => {
  const { alertId } = req.params;
  const alert = storage.resolveAlert(alertId);
  if (!alert) {
    return res.status(404).json({ error: '告警不存在' });
  }
  res.json({
    message: '告警已解决',
    alert
  });
});

router.post('/alerts/:alertId/reopen', (req, res) => {
  const { alertId } = req.params;
  const alert = storage.reopenAlert(alertId);
  if (!alert) {
    return res.status(404).json({ error: '告警不存在' });
  }
  res.json({
    message: '告警已重新打开',
    alert
  });
});

module.exports = router;
