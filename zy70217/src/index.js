const express = require('express');
const store = require('./models/store');

const appointmentsRouter = require('./routes/appointments');
const coldChainRouter = require('./routes/coldChain');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

store.initSampleData();

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '诊所疫苗预约冷链 API',
    version: '1.0.0',
    endpoints: {
      appointments: '/api/appointments',
      coldChain: '/api/cold-chain',
      reports: '/api/reports',
      health: '/health'
    },
    sampleData: {
      vaccines: ['HPV九价疫苗(v1)', '新冠疫苗(v2)', '流感疫苗(v3)'],
      coldBoxes: ['主冷库-01(box1)', '备用冷库-02(box2)'],
      inventoryBatches: ['HPV-2024-001(inv1)', 'HPV-2024-002(inv2)', 'COVID-2024-001(inv3)']
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/appointments', appointmentsRouter);
app.use('/api/cold-chain', coldChainRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
    statusCode: err.statusCode || 500
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 诊所疫苗预约冷链 API 已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/health`);
  console.log(`📖 系统概览: http://localhost:${PORT}/api/reports/overview`);
  console.log(`\n💡 快速开始:`);
  console.log(`   1. 创建预约: POST /api/appointments`);
  console.log(`   2. 查看库存: GET /api/cold-chain/inventory`);
  console.log(`   3. 剂次报表: GET /api/reports/doses`);
  console.log(`\n`);
});

module.exports = app;
