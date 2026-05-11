const express = require('express');
const routes = require('./routes');
const { initializeSampleData } = require('./sample');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '订阅客服退款 API',
    version: '1.0.0',
    endpoints: {
      subscriptions: 'POST /api/subscriptions - 创建订阅',
      payments: 'POST /api/payments - 登记付款',
      refundCalculate: 'POST /api/refunds/calculate - 试算退款金额',
      refunds: 'POST /api/refunds - 提交退款申请',
      refundReview: 'POST /api/refunds/:refundId/review - 审核退款',
      reconciliation: 'GET /api/reconciliation - 按日期对账',
      logs: 'GET /api/logs - 操作日志',
      plans: 'GET /api/plans - 订阅计划列表',
      coupons: 'GET /api/coupons - 优惠券列表',
      agents: 'GET /api/agents - 客服人员列表',
      health: 'GET /api/health - 健康检查'
    },
    builtInAgents: [
      { id: 'AGENT_001', name: '张小明', role: 'agent' },
      { id: 'AGENT_002', name: '李小红', role: 'agent' },
      { id: 'SUP_001', name: '王主管', role: 'supervisor' }
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: '接口不存在' });
});

initializeSampleData();

app.listen(PORT, () => {
  console.log('=========================================');
  console.log('   订阅客服退款 API 已启动');
  console.log('=========================================');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('快速开始:');
  console.log(`  运行演示: npm run demo`);
  console.log(`  健康检查: curl http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('内置测试账号:');
  console.log('  AGENT_001 - 张小明 (客服)');
  console.log('  AGENT_002 - 李小红 (客服)');
  console.log('  SUP_001  - 王主管 (主管)');
  console.log('=========================================');
});
