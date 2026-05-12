const express = require('express');
const fs = require('fs');
const path = require('path');
const { Elder, Prescription, PillBox, Distribution, Receipt, Issue } = require('./models');
const services = require('./services');
const { BusinessError } = require('./errors');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./database');

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

function handleSuccess(res, data) {
  res.json({
    success: true,
    data
  });
}

function handleError(res, err) {
  if (err instanceof BusinessError) {
    res.status(err.http).json(err.toResponse());
  } else {
    console.error('Unexpected error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        details: err.message
      },
      issueRecorded: false
    });
  }
}

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'nursing-home-medication-api'
    }
  });
});

app.get('/api/elders', (req, res) => {
  try {
    const elders = Elder.list(req.query.status);
    handleSuccess(res, elders);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/elders/:id', (req, res) => {
  try {
    const elder = Elder.get(req.params.id);
    handleSuccess(res, elder);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/elders', (req, res) => {
  try {
    const elder = Elder.create(req.body);
    handleSuccess(res, elder);
  } catch (err) {
    handleError(res, err);
  }
});

app.put('/api/elders/:id', (req, res) => {
  try {
    const elder = Elder.update(req.params.id, req.body);
    handleSuccess(res, elder);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/elders/:id/prescriptions', (req, res) => {
  try {
    const prescriptions = Prescription.listByElder(req.params.id);
    handleSuccess(res, prescriptions);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/prescriptions/:id', (req, res) => {
  try {
    const prescription = Prescription.get(req.params.id);
    handleSuccess(res, prescription);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/prescriptions', (req, res) => {
  try {
    const prescription = Prescription.create(req.body);
    handleSuccess(res, prescription);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/elders/:id/pill-boxes', (req, res) => {
  try {
    const boxes = PillBox.listByElder(req.params.id);
    handleSuccess(res, boxes);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/pill-boxes/:id', (req, res) => {
  try {
    const pillBox = PillBox.get(req.params.id);
    handleSuccess(res, pillBox);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/pill-boxes', (req, res) => {
  try {
    const pillBox = PillBox.create(req.body);
    handleSuccess(res, pillBox);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/pill-boxes/:id/match', (req, res) => {
  try {
    const summary = services.getMatchingSummary(req.params.id);
    handleSuccess(res, summary);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/distributions', (req, res) => {
  try {
    const result = services.createDistribution(req.body);
    handleSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/distributions/:id', (req, res) => {
  try {
    const distribution = Distribution.get(req.params.id);
    handleSuccess(res, distribution);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/receipts', (req, res) => {
  try {
    const result = services.createReceipt(req.body);
    handleSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/receipts/:id', (req, res) => {
  try {
    const receipt = Receipt.get(req.params.id);
    handleSuccess(res, receipt);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/issues', (req, res) => {
  try {
    if (req.query.elder_id) {
      const issues = services.getRelevantIssues(req.query.elder_id);
      handleSuccess(res, issues);
    } else {
      const issues = Issue.list(req.query.status);
      handleSuccess(res, issues);
    }
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/issues/:id', (req, res) => {
  try {
    const issue = Issue.get(req.params.id);
    handleSuccess(res, issue);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/issues/:id/resolve', (req, res) => {
  try {
    const issue = Issue.resolve(req.params.id, req.body.notes);
    handleSuccess(res, issue);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/rules', (req, res) => {
  handleSuccess(res, {
    statusFlow: services.STATUS_FLOW,
    keyRules: [
      '1. 药盒分发前必须匹配当前有效的医嘱',
      '2. 药品名称+剂量必须完全一致',
      '3. 药品数量必须与医嘱一致',
      '4. 药盒不能包含未医嘱药品',
      '5. 医嘱必须在有效期内',
      '6. 老人与医嘱、药盒必须匹配',
      '7. 服药回执药品必须与分发药盒一致',
      '8. 任何不匹配都会记录到问题列表'
    ],
    errorCodes: {
      _note: '所有业务错误都会被记录到issues表，返回issueRecorded=true'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  养老院药盒分发核验API 服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`  规则说明: http://localhost:${PORT}/api/rules`);
  console.log(`========================================\n`);
});

module.exports = app;
