const express = require('express');

const { initDatabase } = require('./database');
const { generateRequestId, idempotencyCheck, errorHandler } = require('./middleware');

const eldersRouter = require('./routes/elders');
const careItemsRouter = require('./routes/care-items');
const shiftsRouter = require('./routes/shifts');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(generateRequestId);
app.use(idempotencyCheck);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - RequestID: ${req.requestId}`);
  next();
});

app.use('/api/elders', eldersRouter);
app.use('/api/care-items', careItemsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/audit', auditRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '养老院护理交接 API 运行正常',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path,
    requestId: req.requestId
  });
});

initDatabase();

app.listen(PORT, () => {
  console.log(`
========================================
  养老院护理交接 API 服务已启动
  端口: ${PORT}
  健康检查: http://localhost:${PORT}/api/health
  启动时间: ${new Date().toLocaleString('zh-CN')}
========================================
  `);
});
