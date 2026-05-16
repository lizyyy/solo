const express = require('express');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const datasetsRouter = require('./routes/datasets');
const rulesRouter = require('./routes/rules');
const riskSamplesRouter = require('./routes/riskSamples');
const arbitrationRouter = require('./routes/arbitration');
const reprocessTasksRouter = require('./routes/reprocessTasks');
const exportRouter = require('./routes/export');

app.use('/api/datasets', datasetsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/risk-samples', riskSamplesRouter);
app.use('/api/arbitration', arbitrationRouter);
app.use('/api/reprocess-tasks', reprocessTasksRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'anonymization-arbitration-api',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在',
    code: 'NOT_FOUND',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    code: 'INTERNAL_SERVER_ERROR',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`匿名化任务仲裁API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});