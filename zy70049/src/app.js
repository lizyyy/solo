const express = require('express');
const cron = require('node-cron');
const path = require('path');

const samplesRouter = require('./routes/samples');
const tasksRouter = require('./routes/tasks');
const approvalsRouter = require('./routes/approvals');
const auditRouter = require('./routes/audit');
const TaskService = require('./services/taskService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/samples', samplesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/audit', auditRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

cron.schedule('0 8 * * *', () => {
  console.log(`[${new Date().toISOString()}] Starting scheduled task generation...`);
  try {
    const result = TaskService.generateExpiryTasks();
    console.log(`[${new Date().toISOString()}] Scheduled task result:`, result);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scheduled task failed:`, err.message);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Shanghai'
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  - POST /api/samples          - 创建留样台账`);
  console.log(`  - GET  /api/samples          - 查询留样列表`);
  console.log(`  - POST /api/samples/:id/supplement - 补录留样`);
  console.log(`  - POST /api/samples/:id/withdraw   - 撤回留样`);
  console.log(`  - POST /api/tasks/generate   - 生成到期任务`);
  console.log(`  - POST /api/approvals/submit - 提交销毁审批`);
  console.log(`  - POST /api/approvals/:id/approve - 审批通过`);
  console.log(`  - POST /api/approvals/:id/reject  - 审批驳回`);
  console.log(`  - POST /api/approvals/:taskId/complete - 完成销毁（上传照片）`);
  console.log(`  - POST /api/tasks/:id/extend - 异常延期`);
  console.log(`  - GET  /api/audit/logs       - 审计清单`);
  console.log(`  - GET  /api/audit/summary    - 统计概览`);
  console.log(`\nScheduled task: Daily at 08:00 Asia/Shanghai`);
});

function handleShutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = app;
