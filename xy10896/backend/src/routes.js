const express = require('express');
const router = express.Router();
const models = require('./models');

router.post('/subscriptions', (req, res) => {
  const { serviceName, teamName, apiPath, fields } = req.body;
  if (!serviceName || !teamName || !apiPath || !fields) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const subscription = models.createSubscription(serviceName, teamName, apiPath, fields);
  res.status(201).json(subscription);
});

router.get('/subscriptions', (req, res) => {
  res.json(models.getAllSubscriptions());
});

router.post('/changes', (req, res) => {
  const { apiPath, oldSchema, newSchema, commitAuthor, commitMessage } = req.body;
  if (!apiPath || !oldSchema || !newSchema) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const change = models.createChange(apiPath, oldSchema, newSchema, commitAuthor, commitMessage);
  res.status(201).json(change);
});

router.get('/changes', (req, res) => {
  res.json(models.getAllChanges());
});

router.get('/confirmations', (req, res) => {
  const { status, teamName, changeId } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (teamName) filters.teamName = teamName;
  if (changeId) filters.changeId = changeId;
  res.json(models.getConfirmations(filters));
});

router.post('/confirmations/:id/confirm', (req, res) => {
  const { note } = req.body;
  const confirmation = models.confirmImpact(req.params.id, note || '');
  if (!confirmation) {
    return res.status(404).json({ error: '确认记录不存在' });
  }
  res.json(confirmation);
});

router.post('/confirmations/:id/unaffected', (req, res) => {
  const { note } = req.body;
  const confirmation = models.markAsUnaffected(req.params.id, note || '');
  if (!confirmation) {
    return res.status(404).json({ error: '确认记录不存在' });
  }
  res.json(confirmation);
});

router.get('/export/unconfirmed', (req, res) => {
  const list = models.exportUnconfirmedList();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=unconfirmed-list.json');
  res.json(list);
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
