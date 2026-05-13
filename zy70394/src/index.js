const express = require('express');
const bodyParser = require('body-parser');

const StorageService = require('./services/storage');
const RulesEngine = require('./services/rulesEngine');
const {
  RetirementApplication,
  CallLog,
  TaskDependency,
  Alert,
  DocumentLink,
  Confirmation
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
  return missing;
}

function notFoundResponse(res, resource, id) {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: `${resource} not found`,
    id: id
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'service-retirement-api', version: '1.0.0' });
});

app.post('/api/v1/applications', (req, res) => {
  const missing = validateRequiredFields(req.body, ['serviceName', 'createdBy']);
  if (missing.length > 0) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: `缺少必填字段: ${missing.join(', ')}`
    });
  }

  const application = new RetirementApplication(req.body);
  application.status = 'ACTIVE';
  StorageService.saveApplication(application);

  res.status(201).json({
    id: application.id,
    serviceName: application.serviceName,
    status: application.status,
    createdAt: application.createdAt,
    expiresAt: application.expiresAt
  });
});

app.get('/api/v1/applications', (req, res) => {
  const applications = StorageService.getAllApplications();
  
  res.json({
    total: applications.length,
    applications: applications.map(app => ({
      id: app.id,
      serviceName: app.serviceName,
      serviceVersion: app.serviceVersion,
      status: app.status,
      planedRetirementDate: app.planedRetirementDate,
      actualRetirementDate: app.actualRetirementDate,
      createdAt: app.createdAt,
      expiresAt: app.expiresAt
    }))
  });
});

app.get('/api/v1/applications/:id', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const report = RulesEngine.generateRetirementReport(application);

  res.json({
    application: {
      id: application.id,
      serviceName: application.serviceName,
      serviceVersion: application.serviceVersion,
      description: application.description,
      status: application.status,
      planedRetirementDate: application.planedRetirementDate,
      actualRetirementDate: application.actualRetirementDate,
      createdAt: application.createdAt,
      expiresAt: application.expiresAt,
      createdBy: application.createdBy,
      notes: application.notes
    },
    blockingItems: report.blockingItems,
    confirmationStatus: report.confirmationStatus,
    lastCallTime: report.lastCallTime,
    callers: report.callers,
    retirementWindow: report.retirementWindow,
    summary: report.summary,
    documents: StorageService.getDocumentsByApplicationId(application.id)
  });
});

app.post('/api/v1/applications/:id/call-logs', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'INVALID_FORMAT',
      message: '请求体必须是数组'
    });
  }

  const logs = req.body.map(log => new CallLog({
    ...log,
    applicationId: req.params.id
  }));

  StorageService.saveCallLogs(logs);

  res.status(201).json({
    imported: logs.length,
    logs: logs.map(log => ({
      id: log.id,
      callerService: log.callerService,
      calledEndpoint: log.calledEndpoint,
      callTime: log.callTime
    }))
  });
});

app.post('/api/v1/applications/:id/tasks', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'INVALID_FORMAT',
      message: '请求体必须是数组'
    });
  }

  const tasks = req.body.map(task => new TaskDependency({
    ...task,
    applicationId: req.params.id
  }));

  StorageService.saveTasks(tasks);

  res.status(201).json({
    imported: tasks.length,
    tasks: tasks.map(task => ({
      id: task.id,
      taskName: task.taskName,
      taskType: task.taskType,
      isCritical: task.isCritical,
      migrationStatus: task.migrationStatus
    }))
  });
});

app.post('/api/v1/applications/:id/alerts', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'INVALID_FORMAT',
      message: '请求体必须是数组'
    });
  }

  const alerts = req.body.map(alert => new Alert({
    ...alert,
    applicationId: req.params.id
  }));

  StorageService.saveAlerts(alerts);

  res.status(201).json({
    imported: alerts.length,
    alerts: alerts.map(alert => ({
      id: alert.id,
      alertName: alert.alertName,
      severity: alert.severity,
      status: alert.status
    }))
  });
});

app.post('/api/v1/applications/:id/documents', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'INVALID_FORMAT',
      message: '请求体必须是数组'
    });
  }

  const docs = req.body.map(doc => new DocumentLink({
    ...doc,
    applicationId: req.params.id
  }));

  StorageService.saveDocuments(docs);

  res.status(201).json({
    imported: docs.length,
    documents: docs.map(doc => ({
      id: doc.id,
      linkName: doc.linkName,
      linkUrl: doc.linkUrl,
      documentType: doc.documentType
    }))
  });
});

app.post('/api/v1/applications/:id/confirmations', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'INVALID_FORMAT',
      message: '请求体必须是数组'
    });
  }

  const confirmations = req.body.map(conf => new Confirmation({
    ...conf,
    applicationId: req.params.id
  }));

  StorageService.saveConfirmations(confirmations);

  res.status(201).json({
    imported: confirmations.length,
    confirmations: confirmations.map(conf => ({
      id: conf.id,
      personName: conf.personName,
      role: conf.role,
      confirmed: conf.confirmed
    }))
  });
});

app.post('/api/v1/applications/:id/confirmations/:confirmationId/confirm', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const confirmations = StorageService.getConfirmationsByApplicationId(req.params.id);
  const confirmation = confirmations.find(c => c.id === req.params.confirmationId);

  if (!confirmation) {
    return notFoundResponse(res, 'Confirmation', req.params.confirmationId);
  }

  if (confirmation.confirmed) {
    return res.status(409).json({
      error: 'ALREADY_CONFIRMED',
      message: '该确认已被处理'
    });
  }

  confirmation.confirm();
  StorageService.saveConfirmations([confirmation]);

  res.json({
    id: confirmation.id,
    personName: confirmation.personName,
    confirmed: confirmation.confirmed,
    confirmedAt: confirmation.confirmedAt
  });
});

app.put('/api/v1/applications/:id/tasks/:taskId', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const task = StorageService.updateTask(req.params.taskId, req.body);
  if (!task) {
    return notFoundResponse(res, 'Task', req.params.taskId);
  }

  res.json({
    id: task.id,
    taskName: task.taskName,
    migrationStatus: task.migrationStatus,
    isCritical: task.isCritical
  });
});

app.put('/api/v1/applications/:id/alerts/:alertId', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const alert = StorageService.updateAlert(req.params.alertId, req.body);
  if (!alert) {
    return notFoundResponse(res, 'Alert', req.params.alertId);
  }

  res.json({
    id: alert.id,
    alertName: alert.alertName,
    status: alert.status
  });
});

app.post('/api/v1/applications/:id/extend', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const days = parseInt(req.body.days) || 30;
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + days);
  
  application.expiresAt = newExpiry.toISOString();
  application.status = 'ACTIVE';
  StorageService.saveApplication(application);

  res.json({
    id: application.id,
    serviceName: application.serviceName,
    expiresAt: application.expiresAt,
    status: application.status,
    extendedDays: days
  });
});

app.post('/api/v1/applications/:id/close', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const checkResult = RulesEngine.canCloseApplication(application);
  if (!checkResult.canClose) {
    return res.status(409).json({
      error: 'CANNOT_CLOSE',
      message: checkResult.reason,
      blockingItems: checkResult.blockingItems
    });
  }

  const closedAt = new Date().toISOString();
  application.status = 'CLOSED';
  application.actualRetirementDate = closedAt;
  StorageService.saveApplication(application);

  const archivedReport = RulesEngine.generateArchivedReport(application, closedAt);

  res.json({
    id: application.id,
    serviceName: application.serviceName,
    status: application.status,
    actualRetirementDate: application.actualRetirementDate,
    archivedReport: {
      id: archivedReport.id,
      summary: archivedReport.summary,
      isArchived: archivedReport.isArchived
    }
  });
});

app.get('/api/v1/applications/:id/reports', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const reports = StorageService.getReportsByApplicationId(req.params.id);

  res.json({
    applicationId: req.params.id,
    total: reports.length,
    reports: reports.map(report => ({
      id: report.id,
      generatedAt: report.generatedAt,
      isArchived: report.isArchived,
      summary: report.summary,
      blockingCount: report.blockingItems.length,
      retirementWindow: report.retirementWindow
    }))
  });
});

app.get('/api/v1/applications/:id/reports/latest', (req, res) => {
  const application = StorageService.getApplicationById(req.params.id);
  if (!application) {
    return notFoundResponse(res, 'Application', req.params.id);
  }

  const latestReport = StorageService.getLatestReportByApplicationId(req.params.id);
  if (!latestReport) {
    return res.status(404).json({
      error: 'NO_REPORTS',
      message: '该申请暂无报告'
    });
  }

  res.json(latestReport);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`Service Retirement API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
