const express = require('express');
const bodyParser = require('body-parser');
const ECNService = require('./services/ecnService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: '工程变更通知 API',
    version: '1.0.0',
    description: '处理制造工程变更后的物料、在制单、采购单和客户订单通知',
    endpoints: {
      'POST /api/ecn': '创建工程变更单',
      'PUT /api/ecn/:id/submit': '提交工程变更单',
      'PUT /api/ecn/:id/analyze': '添加影响分析',
      'PUT /api/ecn/:id/approve': '审批通过',
      'PUT /api/ecn/:id/execute': '开始执行',
      'PUT /api/ecn/:id/complete': '完成变更单',
      'GET /api/ecn': '查询所有变更单',
      'GET /api/ecn/:id': '查询变更单详情',
      'GET /api/ecn/:id/history': '查询历史记录',
      'GET /api/ecn/:id/report': '导出报告',
      'GET /api/ecn/:id/responsible': '查询责任人',
      'POST /api/ecn/:id/notify': '通知相关方',
      'POST /api/ecn/:id/acknowledge': '确认收到',
      'POST /api/ecn/:id/complete-item': '完成单项处理',
      'POST /api/ecn/:id/exception': '记录异常',
      'PUT /api/ecn/:id/retry': '重试失败',
      'PUT /api/ecn/:id/manual-update': '人工修正'
    }
  });
});

app.post('/api/ecn', (req, res) => {
  const result = ECNService.createECN(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/submit', (req, res) => {
  const result = ECNService.submitECN(req.params.id, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/analyze', (req, res) => {
  const result = ECNService.addImpactAnalysis(req.params.id, req.body.impactData, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/approve', (req, res) => {
  const result = ECNService.approveECN(req.params.id, req.body.approver);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/execute', (req, res) => {
  const result = ECNService.startExecution(req.params.id, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/complete', (req, res) => {
  const result = ECNService.completeECN(req.params.id, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.get('/api/ecn', (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.urgency) filter.urgency = req.query.urgency;
  
  const result = ECNService.getAllECNs(filter);
  res.json(result);
});

app.get('/api/ecn/:id', (req, res) => {
  const result = ECNService.getECNDetail(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

app.get('/api/ecn/:id/history', (req, res) => {
  const result = ECNService.getECNDetail(req.params.id);
  if (result.success) {
    res.json({
      success: true,
      data: {
        ecnId: req.params.id,
        history: result.data.history
      }
    });
  } else {
    res.status(404).json(result);
  }
});

app.get('/api/ecn/:id/report', (req, res) => {
  const result = ECNService.generateReport(req.params.id);
  if (result.success) {
    if (req.query.format === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename=ecn-report-${req.params.id}.json`);
      res.setHeader('Content-Type', 'application/json');
      res.json(result.data);
    } else {
      res.json(result);
    }
  } else {
    res.status(404).json(result);
  }
});

app.get('/api/ecn/:id/responsible', (req, res) => {
  const result = ECNService.getResponsiblePersons(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

app.post('/api/ecn/:id/notify', (req, res) => {
  const result = ECNService.notifyItem(
    req.params.id,
    req.body.itemType,
    req.body.itemId,
    req.body.operator
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/ecn/:id/acknowledge', (req, res) => {
  const result = ECNService.acknowledgeItem(
    req.params.id,
    req.body.itemType,
    req.body.itemId,
    req.body.operator,
    req.body.confirmationData
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/ecn/:id/complete-item', (req, res) => {
  const result = ECNService.completeItem(
    req.params.id,
    req.body.itemType,
    req.body.itemId,
    req.body.operator,
    req.body.completionData
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/ecn/:id/exception', (req, res) => {
  const result = ECNService.handleException(
    req.params.id,
    req.body.errorInfo,
    req.body.operator
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/retry', (req, res) => {
  const result = ECNService.retryFromFailure(req.params.id, req.body.operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.put('/api/ecn/:id/manual-update', (req, res) => {
  const result = ECNService.manualUpdate(
    req.params.id,
    req.body.itemType,
    req.body.itemId,
    req.body.updates,
    req.body.operator
  );
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    errorCode: 'INTERNAL_ERROR',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`工程变更通知 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`查看接口列表: http://localhost:${PORT}/`);
});

module.exports = app;
