const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

require('./database');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/packages', require('./routes/packages'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 500,
      message: '服务器内部错误'
    }
  });
});

app.listen(PORT, () => {
  console.log(`中药代煎包裹核验API服务运行在 http://localhost:${PORT}`);
  console.log(`测试: curl http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 端点:');
  console.log('  健康检查:     GET  /health');
  console.log('  处方管理:     POST /api/prescriptions');
  console.log('                GET  /api/prescriptions');
  console.log('                GET  /api/prescriptions/:id');
  console.log('                PUT  /api/prescriptions/:id');
  console.log('                POST /api/prescriptions/:id/withdraw');
  console.log('                POST /api/prescriptions/:id/supplement');
  console.log('                GET  /api/prescriptions/:id/history');
  console.log('  煎煮批次:     POST /api/batches');
  console.log('                GET  /api/batches');
  console.log('                GET  /api/batches/:id');
  console.log('                POST /api/batches/:id/start');
  console.log('                POST /api/batches/:id/complete');
  console.log('                POST /api/batches/:id/cancel');
  console.log('                PUT  /api/batches/:id (人工修正)');
  console.log('                GET  /api/batches/:id/history');
  console.log('  包裹管理:     POST /api/packages');
  console.log('                GET  /api/packages');
  console.log('                GET  /api/packages/:id');
  console.log('                POST /api/packages/:id/bind');
  console.log('                POST /api/packages/:id/verify (核心核验)');
  console.log('                POST /api/packages/:id/isolate (错包隔离)');
  console.log('                POST /api/packages/:id/rebind (人工重绑)');
  console.log('                PUT  /api/packages/:id (人工修正)');
  console.log('                GET  /api/packages/scan/:code (扫码查询)');
  console.log('                GET  /api/packages/:id/history');
  console.log('');
  console.log('演示命令:');
  console.log('  npm run demo       - 最短演示路径（正常流程）');
  console.log('  npm run demo-error - 异常触发路径');
});
