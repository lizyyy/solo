const express = require('express');
const fs = require('fs');
const path = require('path');
const { initSchema } = require('./schema');
const { initDb } = require('./database');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: '售楼认购锁房API',
    version: '1.0.0',
    description: '房源、定金、改名、退定、佣金状态一致管理',
    endpoints: {
      projects: '/api/projects',
      properties: '/api/properties',
      channels: '/api/channels',
      customers: '/api/customers',
      bookings: '/api/bookings',
      deposits: '/api/deposits',
      name_changes: '/api/name-changes',
      refunds: '/api/refunds',
      commissions: '/api/commissions',
      reports: '/api/reports'
    },
    health: '/health'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const projectsRouter = require('./routes/projects');
const propertiesRouter = require('./routes/properties');
const channelsRouter = require('./routes/channels');
const customersRouter = require('./routes/customers');
const bookingsRouter = require('./routes/bookings');
const depositsRouter = require('./routes/deposits');
const nameChangesRouter = require('./routes/name-changes');
const refundsRouter = require('./routes/refunds');
const commissionsRouter = require('./routes/commissions');
const reportsRouter = require('./routes/reports');

app.use('/api/projects', projectsRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/deposits', depositsRouter);
app.use('/api/name-changes', nameChangesRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/commissions', commissionsRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

const startServer = async () => {
  await initDb();
  initSchema();
  
  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('售楼认购锁房API 已启动');
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('主要接口:');
    console.log('  GET  /                          - API信息');
    console.log('  GET  /health                    - 健康检查');
    console.log('');
    console.log('  POST /api/projects              - 创建楼盘');
    console.log('  POST /api/properties            - 创建房源');
    console.log('  POST /api/channels              - 创建渠道');
    console.log('  POST /api/customers             - 创建客户');
    console.log('  POST /api/bookings              - 创建认购单');
    console.log('  POST /api/bookings/:id/lock     - 锁定房源');
    console.log('  POST /api/deposits              - 创建定金单');
    console.log('  POST /api/deposits/callback     - 支付回调');
    console.log('  POST /api/name-changes          - 改名申请');
    console.log('  POST /api/refunds               - 退定申请');
    console.log('  POST /api/commissions           - 创建佣金');
    console.log('');
    console.log('  GET  /api/reports/dashboard     - 仪表盘');
    console.log('  GET  /api/reports/export        - 导出报告');
    console.log('');
    console.log('='.repeat(60));
  });
};

startServer();

module.exports = app;
