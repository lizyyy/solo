const express = require('express');
const { initSampleData } = require('./src/models/store');
const archiveRoutes = require('./src/routes/archiveRoutes');

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/api/archive', archiveRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '归档任务保留策略 API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/archive/health',
      policies: 'GET /api/archive/policies',
      freezes: 'GET /api/archive/freezes',
      tasks: {
        list: 'GET /api/archive/tasks',
        create: 'POST /api/archive/tasks',
        execute: 'POST /api/archive/tasks/:taskId/execute',
        retry: 'POST /api/archive/tasks/:taskId/retry',
        details: 'GET /api/archive/tasks/:taskId'
      },
      recovery: {
        list: 'GET /api/archive/recovery-requests',
        create: 'POST /api/archive/recovery-requests',
        approve: 'POST /api/archive/recovery-requests/:requestId/approve'
      },
      report: 'GET /api/archive/report',
      auditLogs: 'GET /api/archive/audit-logs',
      recordStatus: 'GET /api/archive/record-status/:dataType/:recordId'
    }
  });
});

initSampleData();
console.log('[初始化] 样例数据已加载完成');
console.log('[信息] 策略配置: order=2年, ticket=1.5年, message=6个月');
console.log('[信息] 冻结记录: ORD-2022-002 (法律诉讼), TKT-2022-002 (合规审查)');

app.listen(PORT, () => {
  console.log(`\n[服务启动] 归档任务保留策略 API 已在 http://localhost:${PORT} 运行`);
});
