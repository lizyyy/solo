const express = require('express');
const router = express.Router();
const storage = require('../services/storage');

router.post('/queues/:queueName/metrics', (req, res) => {
  const { queueName } = req.params;
  const { timestamp, produceRate, consumeRate, backlogCount, failureCount, partitionMetrics } = req.body;
  if (!timestamp || produceRate === undefined || consumeRate === undefined || backlogCount === undefined) {
    return res.status(400).json({ error: '缺少必需字段: timestamp, produceRate, consumeRate, backlogCount' });
  }
  const isNew = storage.addQueueMetrics(queueName, {
    timestamp,
    produceRate,
    consumeRate,
    backlogCount,
    failureCount: failureCount || 0,
    partitionMetrics: partitionMetrics || []
  });
  res.json({ success: true, isNew });
});

router.get('/queues/:queueName/metrics', (req, res) => {
  const { queueName } = req.params;
  const metrics = storage.getQueueMetrics(queueName);
  res.json({ queueName, metrics });
});

router.post('/consumers/:groupId/heartbeat', (req, res) => {
  const { groupId } = req.params;
  const { timestamp, instanceId, consumerCount, status } = req.body;
  if (!timestamp || !instanceId) {
    return res.status(400).json({ error: '缺少必需字段: timestamp, instanceId' });
  }
  const isNew = storage.addConsumerHeartbeat(groupId, {
    timestamp,
    instanceId,
    consumerCount: consumerCount || 1,
    status: status || 'healthy'
  });
  res.json({ success: true, isNew });
});

router.get('/consumers/:groupId/heartbeat', (req, res) => {
  const { groupId } = req.params;
  const heartbeats = storage.getConsumerHeartbeats(groupId);
  const latest = storage.getLatestHeartbeat(groupId);
  res.json({ groupId, latest, heartbeats });
});

router.post('/queues/:queueName/failures', (req, res) => {
  const { queueName } = req.params;
  const { timestamp, messageId, errorMessage, retryCount, payload } = req.body;
  if (!timestamp) {
    return res.status(400).json({ error: '缺少必需字段: timestamp' });
  }
  const isNew = storage.addFailureSample(queueName, {
    timestamp,
    messageId: messageId || `msg_${Date.now()}_${Math.random()}`,
    errorMessage: errorMessage || '未知错误',
    retryCount: retryCount || 0,
    payload
  });
  res.json({ success: true, isNew });
});

router.get('/queues/:queueName/failures', (req, res) => {
  const { queueName } = req.params;
  const samples = storage.getFailureSamples(queueName);
  res.json({ queueName, samples });
});

router.post('/retry/:retryName/status', (req, res) => {
  const { retryName } = req.params;
  const { timestamp, totalCount, messages } = req.body;
  if (!timestamp) {
    return res.status(400).json({ error: '缺少必需字段: timestamp' });
  }
  const isNew = storage.updateRetryQueueStatus(retryName, {
    timestamp,
    totalCount: totalCount || 0,
    messages: messages || []
  });
  res.json({ success: true, isNew });
});

router.get('/retry/:retryName/status', (req, res) => {
  const { retryName } = req.params;
  const status = storage.getRetryQueueStatus(retryName);
  if (!status) {
    return res.status(404).json({ error: '重试队列状态不存在' });
  }
  res.json(status);
});

module.exports = router;
