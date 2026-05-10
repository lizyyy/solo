const express = require('express');
const { IdempotentKeyService, KEY_STATUS } = require('./idempotentKey');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const idempotentService = new IdempotentKeyService({
  defaultTTL: 300000,
  processingTimeout: 60000,
  maxRetryCount: 3,
  cleanupInterval: 10000
});

idempotentService.start();

function wrapResponse(result, res) {
  if (result.success) {
    return res.status(200).json(result);
  }
  
  const statusMap = {
    'KEY_NOT_FOUND': 404,
    'KEY_CONFLICT': 409,
    'KEY_EXPIRED': 410,
    'ALREADY_PROCESSING': 409,
    'MAX_RETRY_EXCEEDED': 429,
    'INVALID_STATUS_FOR_RETRY': 400,
    'SCOPE_LIMIT_EXCEEDED': 429,
    'KEY_MISSING': 400,
    'TASK_NOT_FOUND': 404
  };
  
  const statusCode = statusMap[result.error.code] || 500;
  return res.status(statusCode).json(result);
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'idempotent-key-service'
  });
});

app.post('/api/keys', (req, res) => {
  const result = idempotentService.registerKey(req.body);
  wrapResponse(result, res);
});

app.post('/api/keys/:key/start', (req, res) => {
  const result = idempotentService.startProcessing(req.params.key);
  wrapResponse(result, res);
});

app.post('/api/keys/:key/complete', (req, res) => {
  const result = idempotentService.completeProcessing(req.params.key, req.body.result);
  wrapResponse(result, res);
});

app.post('/api/keys/:key/fail', (req, res) => {
  const result = idempotentService.failProcessing(req.params.key, req.body.error);
  wrapResponse(result, res);
});

app.post('/api/keys/:key/retry', (req, res) => {
  const result = idempotentService.retryProcessing(req.params.key);
  wrapResponse(result, res);
});

app.post('/api/keys/:key/revoke', (req, res) => {
  const result = idempotentService.revokeKey(req.params.key, req.body.reason);
  wrapResponse(result, res);
});

app.get('/api/keys/:key', (req, res) => {
  const result = idempotentService.getKeyStatus(req.params.key);
  wrapResponse(result, res);
});

app.get('/api/keys', (req, res) => {
  const filters = {};
  if (req.query.scope) filters.scope = req.query.scope;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.fromTime) filters.fromTime = parseInt(req.query.fromTime);
  if (req.query.toTime) filters.toTime = parseInt(req.query.toTime);
  
  const result = idempotentService.queryKeys(filters);
  wrapResponse(result, res);
});

app.get('/api/conflicts', (req, res) => {
  const filters = {};
  if (req.query.key) filters.key = req.query.key;
  if (req.query.scope) filters.scope = req.query.scope;
  
  const result = idempotentService.getConflictHistory(filters);
  wrapResponse(result, res);
});

app.get('/api/events', (req, res) => {
  const filters = {};
  if (req.query.eventType) filters.eventType = req.query.eventType;
  if (req.query.key) filters.key = req.query.key;
  
  const result = idempotentService.getEvents(filters);
  wrapResponse(result, res);
});

app.post('/api/scopes/:scope/rules', (req, res) => {
  const result = idempotentService.setScopeRule(req.params.scope, req.body);
  wrapResponse(result, res);
});

app.get('/api/scopes/rules', (req, res) => {
  const result = idempotentService.getScopeRules();
  wrapResponse(result, res);
});

app.post('/api/tasks', (req, res) => {
  const result = idempotentService.queueBackgroundTask(req.body);
  wrapResponse(result, res);
});

app.get('/api/tasks/:taskId', (req, res) => {
  const result = idempotentService.getTaskStatus(req.params.taskId);
  wrapResponse(result, res);
});

app.get('/api/stats', (req, res) => {
  const result = idempotentService.getStats();
  wrapResponse(result, res);
});

app.use((err, req, res, next) => {
  console.error('[SERVER_ERROR]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`
===========================================================
  幂等键生命周期服务已启动
===========================================================
  服务地址: http://localhost:${PORT}
  
  API端点:
  - POST   /api/keys                登记幂等键
  - POST   /api/keys/:key/start     开始处理
  - POST   /api/keys/:key/complete  完成处理
  - POST   /api/keys/:key/fail      标记失败
  - POST   /api/keys/:key/retry     重试处理
  - POST   /api/keys/:key/revoke    撤销幂等键
  - GET    /api/keys/:key           查询幂等键状态
  - GET    /api/keys                批量查询幂等键
  - GET    /api/conflicts           查询冲突历史
  - GET    /api/events              查询事件流
  - POST   /api/scopes/:scope/rules 设置作用域规则
  - GET    /api/scopes/rules        查询作用域规则
  - POST   /api/tasks               提交后台任务
  - GET    /api/tasks/:taskId       查询任务状态
  - GET    /api/stats               获取统计信息
  - GET    /health                  健康检查
  
  状态常量:
${Object.entries(KEY_STATUS).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}
===========================================================
  `);
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在优雅关闭...');
  idempotentService.stop();
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在优雅关闭...');
  idempotentService.stop();
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

module.exports = { app, server, idempotentService };
