const express = require('express');
const contractsRouter = require('./routes/contracts');
const exceptionsRouter = require('./routes/exceptions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '合同条款生效API',
    version: '1.0.0',
    description: '本地可启动的合同条款生效管理系统',
    endpoints: {
      contracts: '/api/contracts',
      exceptions: '/api/exceptions',
      health: '/health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/contracts', contractsRouter);
app.use('/api/exceptions', exceptionsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
========================================
  合同条款生效API 启动成功
========================================
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API文档:  请查看 README.md
========================================
  `);
});