const express = require('express');
const bodyParser = require('body-parser');
const locksRouter = require('./routes/locks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/locks', locksRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log('酒店PMS锁房API服务已启动: http://localhost:' + PORT);
  console.log('健康检查: http://localhost:' + PORT + '/health');
  console.log('API文档:');
  console.log('  POST /api/locks - 创建锁房');
  console.log('  GET  /api/locks - 查询锁房列表');
  console.log('  GET  /api/locks/:id - 查询锁房详情');
  console.log('  GET  /api/locks/:id/history - 查询锁房历史');
  console.log('  POST /api/locks/:id/status - 更新锁房状态');
  console.log('  POST /api/locks/import - 批量导入');
  console.log('  GET  /api/locks/import/:batchId - 查询导入批次');
  console.log('  POST /api/locks/export - 导出锁房记录');
});
