const express = require('express');
const router = express.Router();

const {
  DatasetVersionService,
  DownstreamProjectService,
  AcknowledgmentService,
  RollbackRequestService,
  ReportService,
  OperationLogService
} = require('./services');

const {
  DatasetVersionSchema,
  DownstreamProjectSchema,
  AcknowledgmentSchema,
  AcknowledgeSchema,
  RollbackRequestSchema,
  RollbackApprovalSchema,
  ManualCorrectionSchema
} = require('./models');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const getOperator = (req) => req.headers['x-operator'] || 'anonymous';

const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/dataset-versions', validate(DatasetVersionSchema), wrapAsync(async (req, res) => {
  const result = await DatasetVersionService.create(req.body, getOperator(req));
  res.json(result);
}));

router.post('/dataset-versions/:id/publish', wrapAsync(async (req, res) => {
  const result = await DatasetVersionService.publish(req.params.id, getOperator(req));
  res.json(result);
}));

router.get('/dataset-versions', wrapAsync(async (req, res) => {
  const result = await DatasetVersionService.getAll(req.query);
  res.json({ success: true, data: result });
}));

router.get('/dataset-versions/:id', wrapAsync(async (req, res) => {
  const result = await DatasetVersionService.getById(req.params.id);
  if (result) {
    res.json({ success: true, data: result });
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
}));

router.post('/dataset-versions/:id/manual-correct', validate(ManualCorrectionSchema), wrapAsync(async (req, res) => {
  const result = await DatasetVersionService.manualCorrect(req.params.id, req.body, getOperator(req));
  res.json(result);
}));

router.post('/downstream-projects', validate(DownstreamProjectSchema), wrapAsync(async (req, res) => {
  const result = await DownstreamProjectService.create(req.body, getOperator(req));
  res.json(result);
}));

router.get('/downstream-projects', wrapAsync(async (req, res) => {
  const result = await DownstreamProjectService.getAll();
  res.json({ success: true, data: result });
}));

router.get('/downstream-projects/:id', wrapAsync(async (req, res) => {
  const result = await DownstreamProjectService.getById(req.params.id);
  if (result) {
    res.json({ success: true, data: result });
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
}));

router.post('/acknowledgments', validate(AcknowledgmentSchema), wrapAsync(async (req, res) => {
  const result = await AcknowledgmentService.create(req.body, getOperator(req));
  res.json(result);
}));

router.post('/acknowledgments/:id/acknowledge', validate(AcknowledgeSchema), wrapAsync(async (req, res) => {
  const result = await AcknowledgmentService.acknowledge(req.params.id, req.body, getOperator(req));
  res.json(result);
}));

router.post('/acknowledgments/:id/timeout', wrapAsync(async (req, res) => {
  const result = await AcknowledgmentService.markTimeout(req.params.id, getOperator(req));
  res.json(result);
}));

router.get('/acknowledgments', wrapAsync(async (req, res) => {
  const result = await AcknowledgmentService.getAll(req.query);
  res.json({ success: true, data: result });
}));

router.get('/acknowledgments/:id', wrapAsync(async (req, res) => {
  const result = await AcknowledgmentService.getDetails(req.params.id);
  if (result) {
    res.json({ success: true, data: result });
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
}));

router.post('/acknowledgments/:id/manual-correct', validate(ManualCorrectionSchema), wrapAsync(async (req, res) => {
  const result = await AcknowledgmentService.manualCorrect(req.params.id, req.body, getOperator(req));
  res.json(result);
}));

router.post('/rollback-requests', validate(RollbackRequestSchema), wrapAsync(async (req, res) => {
  const result = await RollbackRequestService.create(req.body, getOperator(req));
  res.json(result);
}));

router.post('/rollback-requests/:id/approve', validate(RollbackApprovalSchema), wrapAsync(async (req, res) => {
  const result = await RollbackRequestService.approve(req.params.id, req.body, getOperator(req));
  res.json(result);
}));

router.get('/rollback-requests', wrapAsync(async (req, res) => {
  const result = await RollbackRequestService.getAll(req.query);
  res.json({ success: true, data: result });
}));

router.get('/rollback-requests/:id', wrapAsync(async (req, res) => {
  const result = await RollbackRequestService.getDetails(req.params.id);
  if (result) {
    res.json({ success: true, data: result });
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
}));

router.post('/reports/acknowledgment/:datasetVersionId', wrapAsync(async (req, res) => {
  const result = await ReportService.generateAcknowledgmentReport(
    req.params.datasetVersionId,
    getOperator(req)
  );
  res.json(result);
}));

router.get('/reports/:id', wrapAsync(async (req, res) => {
  const result = await ReportService.getReport(req.params.id);
  if (result) {
    res.json({ success: true, data: result });
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
}));

router.get('/export/acknowledgment/:datasetVersionId', wrapAsync(async (req, res) => {
  const result = await ReportService.exportToCSV(req.params.datasetVersionId);
  if (result.success) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=acknowledgment-report-${req.params.datasetVersionId}.json`);
    res.json(result.data);
  } else {
    res.status(400).json(result);
  }
}));

router.get('/operation-logs/:entityType/:entityId', wrapAsync(async (req, res) => {
  const result = await OperationLogService.getLogs(req.params.entityType, req.params.entityId);
  res.json({ success: true, data: result });
}));

router.get('/operation-logs/failed', wrapAsync(async (req, res) => {
  const result = await OperationLogService.getAllFailedLogs();
  res.json({ success: true, data: result });
}));

module.exports = router;
