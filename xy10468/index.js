const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(express.json());

const batches = {};
const metricsStore = {};
const thresholdsStore = {};
const eventLogs = {};

const BatchStatus = {
  CREATED: 'CREATED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ROLLED_BACK: 'ROLLED_BACK'
};

const EventType = {
  BATCH_CREATED: 'BATCH_CREATED',
  THRESHOLD_CONFIGURED: 'THRESHOLD_CONFIGURED',
  METRICS_REPORTED: 'METRICS_REPORTED',
  GRAYSCALE_PROMOTED: 'GRAYSCALE_PROMOTED',
  ROLLBACK_TRIGGERED: 'ROLLBACK_TRIGGERED',
  MANUAL_CONFIRMATION: 'MANUAL_CONFIRMATION',
  THRESHOLD_HIT: 'THRESHOLD_HIT',
  METRICS_MISSING: 'METRICS_MISSING'
};

function logEvent(batchId, eventType, data, operator = 'system') {
  if (!eventLogs[batchId]) {
    eventLogs[batchId] = [];
  }
  eventLogs[batchId].push({
    eventId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    operator,
    data
  });
}

function getCurrentRecommendation(batchId) {
  const batch = batches[batchId];
  if (!batch) return null;

  const thresholds = thresholdsStore[batchId] || {};
  const latestMetrics = metricsStore[batchId] || [];

  const recommendations = [];
  const thresholdHits = [];

  if (batch.status === BatchStatus.ROLLED_BACK) {
    return {
      status: 'ROLLED_BACK',
      recommendation: '批次已回滚，无法继续发布',
      thresholdHits: [],
      nextAction: 'no_action'
    };
  }

  if (batch.status === BatchStatus.COMPLETED) {
    return {
      status: 'COMPLETED',
      recommendation: '批次已完成发布',
      thresholdHits: [],
      nextAction: 'no_action'
    };
  }

  const requiredMetrics = Object.keys(thresholds);
  const hasLatestMetrics = latestMetrics.length > 0;
  const latestMetricData = hasLatestMetrics ? latestMetrics[latestMetrics.length - 1].metrics : {};
  const missingMetrics = requiredMetrics.filter(m => !(m in latestMetricData));

  if (requiredMetrics.length > 0 && missingMetrics.length > 0) {
    recommendations.push('关键指标缺失，暂停推进');
    return {
      status: batch.status,
      recommendation: '关键指标缺失，暂停推进',
      missingMetrics,
      thresholdHits,
      nextAction: 'provide_metrics_or_confirm'
    };
  }

  for (const [metricName, threshold] of Object.entries(thresholds)) {
    const value = latestMetricData[metricName];
    if (value !== undefined) {
      if (threshold.type === 'upper' && value > threshold.value) {
        thresholdHits.push({
          metricName,
          value,
          threshold: threshold.value,
          type: 'upper',
          hit: true
        });
      } else if (threshold.type === 'lower' && value < threshold.value) {
        thresholdHits.push({
          metricName,
          value,
          threshold: threshold.value,
          type: 'lower',
          hit: true
        });
      }
    }
  }

  if (thresholdHits.length > 0) {
    recommendations.push('阈值命中，建议回滚');
    return {
      status: batch.status,
      recommendation: '阈值命中，建议回滚',
      thresholdHits,
      nextAction: 'rollback_or_confirm'
    };
  }

  return {
    status: batch.status,
    recommendation: '指标健康，可继续推进',
    thresholdHits,
    nextAction: 'promote_or_complete'
  };
}

app.post('/api/v1/batches', (req, res) => {
  const { version, description, createdBy } = req.body;

  if (!version) {
    return res.status(400).json({ error: 'version is required' });
  }

  const batchId = uuidv4();
  const batch = {
    batchId,
    version,
    description: description || '',
    status: BatchStatus.CREATED,
    grayscaleStage: 0,
    maxGrayscaleStage: 100,
    createdBy: createdBy || 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  batches[batchId] = batch;
  logEvent(batchId, EventType.BATCH_CREATED, { batch });

  res.status(201).json(batch);
});

app.post('/api/v1/batches/:batchId/thresholds', (req, res) => {
  const { batchId } = req.params;
  const { thresholds } = req.body;

  if (!batches[batchId]) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  if (!thresholds || typeof thresholds !== 'object') {
    return res.status(400).json({ error: 'thresholds is required and must be an object' });
  }

  thresholdsStore[batchId] = thresholds;
  logEvent(batchId, EventType.THRESHOLD_CONFIGURED, { thresholds });

  res.json({ batchId, thresholds });
});

app.post('/api/v1/batches/:batchId/metrics', (req, res) => {
  const { batchId } = req.params;
  const { metrics, timestamp } = req.body;

  if (!batches[batchId]) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  if (!metrics || typeof metrics !== 'object') {
    return res.status(400).json({ error: 'metrics is required and must be an object' });
  }

  const metricRecord = {
    metrics,
    timestamp: timestamp || new Date().toISOString()
  };

  if (!metricsStore[batchId]) {
    metricsStore[batchId] = [];
  }
  metricsStore[batchId].push(metricRecord);

  const recommendation = getCurrentRecommendation(batchId);
  logEvent(batchId, EventType.METRICS_REPORTED, { metrics, recommendation });

  if (recommendation.thresholdHits && recommendation.thresholdHits.length > 0) {
    logEvent(batchId, EventType.THRESHOLD_HIT, {
      thresholdHits: recommendation.thresholdHits,
      recommendation: recommendation.recommendation
    });
  }

  if (recommendation.missingMetrics && recommendation.missingMetrics.length > 0) {
    logEvent(batchId, EventType.METRICS_MISSING, {
      missingMetrics: recommendation.missingMetrics
    });
  }

  res.json({
    batchId,
    recorded: true,
    recommendation
  });
});

app.post('/api/v1/batches/:batchId/promote', (req, res) => {
  const { batchId } = req.params;
  const { stage, operator } = req.body;

  const batch = batches[batchId];
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  if (batch.status === BatchStatus.ROLLED_BACK) {
    return res.status(400).json({
      error: '已回滚批次不能再发布',
      batchId,
      currentStatus: batch.status
    });
  }

  if (batch.status === BatchStatus.COMPLETED) {
    return res.status(200).json({
      message: '批次已完成发布，幂等处理',
      batchId,
      currentStatus: batch.status,
      grayscaleStage: batch.grayscaleStage
    });
  }

  const targetStage = stage !== undefined ? stage : Math.min(batch.grayscaleStage + 20, batch.maxGrayscaleStage);

  if (targetStage === batch.grayscaleStage && batch.status === BatchStatus.IN_PROGRESS) {
    return res.status(200).json({
      message: '已到达目标阶段，幂等处理',
      batchId,
      currentStatus: batch.status,
      grayscaleStage: batch.grayscaleStage
    });
  }

  const recommendation = getCurrentRecommendation(batchId);
  if (recommendation.nextAction === 'provide_metrics_or_confirm') {
    return res.status(400).json({
      error: '关键指标缺失，暂停推进',
      missingMetrics: recommendation.missingMetrics,
      recommendation
    });
  }

  if (recommendation.nextAction === 'rollback_or_confirm') {
    return res.status(400).json({
      error: '阈值命中，需先回滚或人工确认',
      thresholdHits: recommendation.thresholdHits,
      recommendation
    });
  }

  batch.grayscaleStage = targetStage;
  batch.status = targetStage >= batch.maxGrayscaleStage ? BatchStatus.COMPLETED : BatchStatus.IN_PROGRESS;
  batch.updatedAt = new Date().toISOString();

  logEvent(batchId, EventType.GRAYSCALE_PROMOTED, {
    fromStage: batch.grayscaleStage - (stage !== undefined ? 0 : 20),
    toStage: targetStage,
    newStatus: batch.status
  }, operator || 'system');

  res.json({
    batchId,
    status: batch.status,
    grayscaleStage: batch.grayscaleStage,
    updatedAt: batch.updatedAt
  });
});

app.post('/api/v1/batches/:batchId/rollback', (req, res) => {
  const { batchId } = req.params;
  const { reason, operator } = req.body;

  const batch = batches[batchId];
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  if (batch.status === BatchStatus.ROLLED_BACK) {
    return res.status(200).json({
      message: '批次已回滚，幂等处理',
      batchId,
      currentStatus: batch.status
    });
  }

  batch.status = BatchStatus.ROLLED_BACK;
  batch.updatedAt = new Date().toISOString();

  logEvent(batchId, EventType.ROLLBACK_TRIGGERED, {
    reason: reason || 'Automatic rollback due to threshold hit',
    previousStatus: batch.status
  }, operator || 'system');

  res.json({
    batchId,
    status: batch.status,
    updatedAt: batch.updatedAt
  });
});

app.post('/api/v1/batches/:batchId/confirm', (req, res) => {
  const { batchId } = req.params;
  const { action, reason, operator } = req.body;

  const batch = batches[batchId];
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  if (!['continue', 'rollback', 'pause'].includes(action)) {
    return res.status(400).json({ error: 'action must be one of: continue, rollback, pause' });
  }

  if (action === 'rollback') {
    batch.status = BatchStatus.ROLLED_BACK;
  } else if (action === 'pause') {
    batch.status = BatchStatus.PAUSED;
  } else if (action === 'continue') {
    batch.status = BatchStatus.IN_PROGRESS;
  }

  batch.updatedAt = new Date().toISOString();

  logEvent(batchId, EventType.MANUAL_CONFIRMATION, {
    action,
    reason: reason || 'Manual confirmation'
  }, operator || 'unknown');

  res.json({
    batchId,
    status: batch.status,
    action,
    updatedAt: batch.updatedAt
  });
});

app.get('/api/v1/batches/:batchId', (req, res) => {
  const { batchId } = req.params;

  const batch = batches[batchId];
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  const recommendation = getCurrentRecommendation(batchId);
  const events = eventLogs[batchId] || [];
  const thresholds = thresholdsStore[batchId] || {};
  const metrics = metricsStore[batchId] || [];

  const thresholdHits = events
    .filter(e => e.eventType === EventType.THRESHOLD_HIT)
    .map(e => ({
      timestamp: e.timestamp,
      data: e.data
    }));

  const timeline = events.map(e => ({
    eventId: e.eventId,
    eventType: e.eventType,
    timestamp: e.timestamp,
    operator: e.operator,
    summary: generateEventSummary(e)
  }));

  res.json({
    batch,
    thresholds,
    latestMetrics: metrics.length > 0 ? metrics[metrics.length - 1] : null,
    recommendation,
    thresholdHits,
    auditLog: events,
    timeline
  });
});

app.get('/api/v1/batches', (req, res) => {
  const allBatches = Object.values(batches);
  res.json({
    total: allBatches.length,
    batches: allBatches
  });
});

function generateEventSummary(event) {
  switch (event.eventType) {
    case EventType.BATCH_CREATED:
      return `批次创建: v${event.data.batch.version}`;
    case EventType.THRESHOLD_CONFIGURED:
      return `配置阈值: ${Object.keys(event.data.thresholds).length} 个指标`;
    case EventType.METRICS_REPORTED:
      return `上报指标: ${Object.keys(event.data.metrics).join(', ')}`;
    case EventType.GRAYSCALE_PROMOTED:
      return `灰度推进: ${event.data.fromStage}% -> ${event.data.toStage}%`;
    case EventType.ROLLBACK_TRIGGERED:
      return `触发回滚: ${event.data.reason}`;
    case EventType.MANUAL_CONFIRMATION:
      return `人工确认: ${event.data.action} - ${event.data.reason}`;
    case EventType.THRESHOLD_HIT:
      return `阈值命中: ${event.data.thresholdHits.map(h => h.metricName).join(', ')}`;
    case EventType.METRICS_MISSING:
      return `指标缺失: ${event.data.missingMetrics.join(', ')}`;
    default:
      return event.eventType;
  }
}

app.listen(PORT, () => {
  console.log(`Release Rollback Decision API is running on http://localhost:${PORT}`);
});
