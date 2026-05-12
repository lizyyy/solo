const express = require('express');
const storage = require('./storage');
const samples = require('./samples');

const app = express();
const PORT = 3000;

app.use(express.json());

function errorHandler(res, error) {
  console.error(error);
  return res.status(400).json({
    success: false,
    error: error.message
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/templates', (req, res) => {
  try {
    const template = storage.createTemplate(req.body);
    res.json({
      success: true,
      template: template
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.get('/api/templates', (req, res) => {
  res.json({
    success: true,
    templates: storage.listTemplates()
  });
});

app.get('/api/templates/:templateId', (req, res) => {
  const template = storage.getTemplate(req.params.templateId);
  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }
  res.json({
    success: true,
    template: template
  });
});

app.post('/api/templates/init-samples', (req, res) => {
  const result = samples.initSamples();
  res.json({
    success: true,
    templates: result
  });
});

app.post('/api/processes', (req, res) => {
  try {
    const { templateId, applicant, formData } = req.body;
    const result = storage.createProcess(templateId, applicant, formData);
    res.json({
      success: true,
      process: result.process,
      nodes: result.nodes
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.post('/api/processes/:processId/approve', (req, res) => {
  try {
    const { approver, comment } = req.body;
    const result = storage.approveNode(req.params.processId, approver, comment);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.post('/api/processes/:processId/reject', (req, res) => {
  try {
    const { approver, comment } = req.body;
    const result = storage.rejectNode(req.params.processId, approver, comment);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.post('/api/processes/:processId/withdraw', (req, res) => {
  try {
    const { applicant } = req.body;
    const result = storage.withdrawProcess(req.params.processId, applicant);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.post('/api/processes/:processId/transfer', (req, res) => {
  try {
    const { currentApprover, newApprover, reason } = req.body;
    const result = storage.transferNode(
      req.params.processId,
      currentApprover,
      newApprover,
      reason
    );
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.get('/api/processes/:processId', (req, res) => {
  const detail = storage.getProcessDetail(req.params.processId);
  if (!detail) {
    return res.status(404).json({
      success: false,
      error: 'Process not found'
    });
  }
  res.json({
    success: true,
    ...detail
  });
});

app.post('/api/timeout/scan', (req, res) => {
  const results = storage.scanAndEscalate();
  res.json({
    success: true,
    ...results
  });
});

app.get('/api/compensations', (req, res) => {
  const status = req.query.status;
  res.json({
    success: true,
    compensations: storage.listCompensations(status)
  });
});

app.post('/api/compensations/:compensationId/process', (req, res) => {
  try {
    const { processedBy } = req.body;
    const result = storage.processCompensation(req.params.compensationId, processedBy);
    res.json({
      success: true,
      compensation: result
    });
  } catch (error) {
    errorHandler(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`Approval Timeout Compensation API running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/templates');
  console.log('  GET  /api/templates');
  console.log('  GET  /api/templates/:templateId');
  console.log('  POST /api/templates/init-samples');
  console.log('  POST /api/processes');
  console.log('  GET  /api/processes/:processId');
  console.log('  POST /api/processes/:processId/approve');
  console.log('  POST /api/processes/:processId/reject');
  console.log('  POST /api/processes/:processId/withdraw');
  console.log('  POST /api/processes/:processId/transfer');
  console.log('  POST /api/timeout/scan');
  console.log('  GET  /api/compensations');
  console.log('  POST /api/compensations/:compensationId/process');
});
