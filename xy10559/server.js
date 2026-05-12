const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

const cardsRoute = require('./routes/cards');
const gateRoute = require('./routes/gate');
const reportsRoute = require('./routes/reports');
const sampleDataService = require('./services/sampleDataService');

app.use('/api/cards', cardsRoute);
app.use('/api/gate', gateRoute);
app.use('/api', reportsRoute);

app.post('/api/samples/init', (req, res) => {
  const result = sampleDataService.createAllSamples();
  res.json({ success: true, ...result });
});

app.post('/api/samples/reset', (req, res) => {
  const result = sampleDataService.resetAllData();
  res.json({ success: true, ...result });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: '停车月卡续费 API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    service: '停车月卡续费 API',
    status: 'running',
    endpoints: {
      cards: '/api/cards',
      gate: '/api/gate',
      reports: '/api/dashboard, /api/anomalies, /api/ledger, /api/operations, /api/export',
      samples: '/api/samples/init, /api/samples/reset',
      health: '/api/health'
    },
    quickStart: [
      '1. POST /api/samples/init - 初始化样例数据',
      '2. GET /api/dashboard - 查看数据概览',
      '3. GET /api/cards - 查看所有月卡',
      '4. GET /api/gate/check-access?plate=京A12345 - 检查车牌通行权限'
    ]
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  停车月卡续费 API 已启动');
  console.log('  服务地址: http://localhost:' + PORT);
  console.log('========================================');
  console.log('');
  console.log('快速开始:');
  console.log('  1. 初始化样例数据:');
  console.log('     curl -X POST http://localhost:' + PORT + '/api/samples/init');
  console.log('');
  console.log('  2. 查看数据概览:');
  console.log('     curl http://localhost:' + PORT + '/api/dashboard');
  console.log('');
  console.log('  3. 查看所有月卡:');
  console.log('     curl http://localhost:' + PORT + '/api/cards');
  console.log('');
  console.log('  4. 检查车牌通行权限:');
  console.log('     curl http://localhost:' + PORT + '/api/gate/check-access?plate=京A12345');
  console.log('');
  console.log('========================================');
});
