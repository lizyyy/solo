const express = require('express');
const cors = require('cors');
const { logger } = require('./utils/logger');

const healthRoutes = require('./routes/health');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

app.use('/health', healthRoutes);
app.use('/api/tasks', taskRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Task Sandbox API',
    version: '1.0.0',
    description: '任务执行沙箱 API - 安全执行用户脚本的服务',
    endpoints: {
      health: '/health',
      ready: '/health/ready',
      tasks: '/api/tasks',
      policies: '/api/tasks/policies',
      quotas: '/api/tasks/quotas',
      states: '/api/tasks/states',
      simulationModes: '/api/tasks/simulation-modes'
    },
    documentation: {
      '创建任务': 'POST /api/tasks',
      '提交任务': 'POST /api/tasks/:taskId/submit',
      '执行任务': 'POST /api/tasks/:taskId/execute',
      '查询任务': 'GET /api/tasks/:taskId',
      '任务列表': 'GET /api/tasks',
      '任务日志': 'GET /api/tasks/:taskId/logs',
      '取消任务': 'POST /api/tasks/:taskId/cancel',
      '终止任务': 'POST /api/tasks/:taskId/kill',
      '导出结果': 'GET /api/tasks/:taskId/export',
      '权限检查': 'GET /api/tasks/:taskId/check-permission',
      '资源信息': 'GET /api/tasks/:taskId/resources',
      '运行中任务': 'GET /api/tasks/running/list'
    }
  });
});

app.use((err, req, res, next) => {
  logger.error('未处理的错误', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '未找到',
    message: `路径不存在: ${req.method} ${req.path}`
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Task Sandbox API 服务启动在端口 ${PORT}`);
    logger.info(`健康检查: http://localhost:${PORT}/health`);
    logger.info(`API 文档: http://localhost:${PORT}/`);
  });
}

module.exports = app;
