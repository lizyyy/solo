const express = require('express');
const PriorityArbitrator = require('./arbitrator/PriorityArbitrator');
const { TASK_TYPES, TENANT_LEVELS, TASK_STATUSES } = require('./models/Task');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const arbitrator = new PriorityArbitrator({ cpu: 8, memory: 16 });

const tasksRouter = require('./routes/tasks');
app.use('/api/tasks', tasksRouter(arbitrator));

app.get('/api/metadata', (req, res) => {
  res.json({
    success: true,
    data: {
      taskTypes: TASK_TYPES,
      tenantLevels: TENANT_LEVELS,
      taskStatuses: TASK_STATUSES,
      serverInfo: {
        version: '1.0.0',
        maxResources: arbitrator.maxResources,
        availableResources: arbitrator.getAvailableResources()
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`任务优先级仲裁 API 服务已启动`);
  console.log(`监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`元数据: http://localhost:${PORT}/api/metadata`);
  console.log(`任务接口: http://localhost:${PORT}/api/tasks`);
  console.log('');
  console.log('可用任务类型:', Object.values(TASK_TYPES).join(', '));
  console.log('可用租户等级:', Object.values(TENANT_LEVELS).join(', '));
});
