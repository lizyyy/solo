const express = require('express');
const billingService = require('./billing-service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '社区充电桩峰谷账单核验 API',
    version: '1.0.0',
    description: '解决社区充电桩跨峰谷电价结算，断网补传后重复计费问题',
    endpoints: {
      configuration: 'GET /api/tariff/:communityId - 获取峰谷电价配置',
      charging: [
        'POST /api/charging/record - 提交充电记录（支持断点补传）',
        'GET /api/charging/session/:sessionId - 获取充电会话详情'
      ],
      billing: [
        'POST /api/billing/generate/:sessionId - 生成账单',
        'POST /api/billing/verify/:billId - 复核账单',
        'POST /api/billing/adjust/:billId - 人工修正账单'
      ],
      dashboard: 'GET /api/dashboard/:communityId - 获取看板数据',
      scenarios: [
        'GET /api/scenarios - 查看所有可复现场景',
        'POST /api/scenarios/:scenarioId - 执行测试场景'
      ]
    }
  });
});

app.get('/api/tariff/:communityId', async (req, res) => {
  try {
    const tariff = await billingService.getTariffConfig(req.params.communityId);
    if (!tariff) {
      return res.status(404).json({ success: false, message: 'Tariff not found' });
    }
    res.json({ success: true, data: tariff });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/charging/record', async (req, res) => {
  try {
    const result = await billingService.processRecord(req.body);
    const statusCode = result.success ? 200 : (
      result.code === 'VALIDATION_ERROR' ? 400 :
      result.code === 'DUPLICATE_REQUEST' ? 409 :
      result.code === 'INVALID_STATE_TRANSITION' ? 400 :
      result.code === 'CONFLICT_DETECTED' ? 409 : 500
    );
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/charging/session/:sessionId', async (req, res) => {
  try {
    const details = await billingService.getSessionDetails(req.params.sessionId);
    if (!details) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/billing/generate/:sessionId', async (req, res) => {
  try {
    const result = await billingService.generateBill(req.params.sessionId);
    const statusCode = result.success ? 200 : (
      result.code === 'SESSION_NOT_FOUND' ? 404 :
      result.code === 'SESSION_NOT_COMPLETE' ? 400 :
      result.code === 'BILL_EXISTS' ? 409 :
      result.code === 'NO_SLICES' ? 400 : 500
    );
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/billing/verify/:billId', async (req, res) => {
  try {
    const result = await billingService.verifyBill(req.params.billId, req.body?.operator || 'api_user');
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/billing/adjust/:billId', async (req, res) => {
  if (!req.body.adjustments) {
    return res.status(400).json({ success: false, message: 'adjustments is required' });
  }
  try {
    const result = await billingService.manuallyAdjustBill(
      req.params.billId,
      req.body.adjustments,
      req.body.operator || 'api_user'
    );
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard/:communityId', async (req, res) => {
  try {
    const stats = await billingService.getDashboardStats(req.params.communityId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const testScenarios = {
  'duplicate-submission': {
    name: '重复提交防护',
    description: '提交相同 request_id 两次，第二次应被拒绝',
    steps: [
      'POST /api/charging/record (request_id=REQ001)',
      'POST /api/charging/record (request_id=REQ001, 同第一条)'
    ],
    expected: ['RECORD_ACCEPTED', 'DUPLICATE_REQUEST']
  },
  'invalid-transition': {
    name: '非法状态流转',
    description: '会话处于 charging 状态时，直接发送 completed 前需要符合状态机规则',
    steps: [
      'POST /api/charging/record (status=charging, 第一次)',
      'POST /api/charging/record (status=charging, 同 session 但时间冲突)'
    ],
    expected: ['RECORD_ACCEPTED', 'CONFLICT_DETECTED']
  },
  'missing-fields': {
    name: '缺字段验证',
    description: '提交缺少必要字段的记录',
    steps: [
      'POST /api/charging/record (缺少 session_id 和 request_id)'
    ],
    expected: ['VALIDATION_ERROR']
  },
  'peak-valley-slicing': {
    name: '跨峰谷切片',
    description: '充电会话跨越峰谷时段，自动切片计算',
    steps: [
      'POST /api/charging/record (跨越 18:00 峰电时段)',
      'GET /api/charging/session/:sessionId (查看切片结果)',
      'POST /api/billing/generate/:sessionId'
    ],
    expected: ['RECORD_ACCEPTED', 'SESSION_DETAILS', 'BILL_GENERATED']
  },
  'network-retransmission': {
    name: '断网补传场景',
    description: '模拟断网后的数据补传（带 is_retransmit 标记）',
    steps: [
      'POST /api/charging/record (第一条, 记录 id=REQ-A)',
      'POST /api/charging/record (补传, is_retransmit=true, original_request_id=REQ-A)',
      'POST /api/charging/record (第二条正常记录)'
    ],
    expected: ['RECORD_ACCEPTED', 'RECORD_ACCEPTED', 'RECORD_ACCEPTED']
  },
  'manual-adjustment': {
    name: '人工修正',
    description: '生成账单后人工调整金额',
    steps: [
      '完成一个充电会话并生成账单',
      'POST /api/billing/verify/:billId',
      'POST /api/billing/adjust/:billId (人工调整)'
    ],
    expected: ['BILL_GENERATED', 'BILL_VERIFIED', 'BILL_ADJUSTED']
  },
  'state-conflict': {
    name: '状态冲突',
    description: '提交的记录电表读数回退（end_kwh < 之前的 end_kwh）',
    steps: [
      'POST /api/charging/record (start=0, end=10)',
      'POST /api/charging/record (start=5, end=15) - 电表读数回退'
    ],
    expected: ['RECORD_ACCEPTED', 'CONFLICT_DETECTED']
  },
  'source-missing': {
    name: '来源记录缺失',
    description: '补传记录引用了不存在的原始请求',
    steps: [
      'POST /api/charging/record (is_retransmit=true, original_request_id=NONEXISTENT)'
    ],
    expected: ['RECORD_ACCEPTED - 系统仍会处理，但会记录原始请求缺失']
  }
};

app.get('/api/scenarios', (req, res) => {
  const scenariosList = Object.entries(testScenarios).map(([id, scenario]) => ({
    id,
    name: scenario.name,
    description: scenario.description
  }));
  res.json({ success: true, count: scenariosList.length, scenarios: scenariosList });
});

app.get('/api/scenarios/:scenarioId', (req, res) => {
  const scenario = testScenarios[req.params.scenarioId];
  if (!scenario) {
    return res.status(404).json({ success: false, message: 'Scenario not found' });
  }
  res.json({ success: true, data: scenario });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`社区充电桩峰谷账单核验 API 已启动`);
  console.log(`========================================`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档: http://localhost:${PORT}/`);
  console.log(`\n使用示例:`);
  console.log(`  curl http://localhost:${PORT}/api/tariff/COMM001`);
  console.log(`  curl http://localhost:${PORT}/api/scenarios`);
  console.log(`\n运行测试场景: npm test`);
  console.log(`========================================\n`);
});

module.exports = app;
