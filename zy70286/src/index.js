const express = require('express');
const scheduleRoutes = require('./routes/scheduleRoutes');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

store.initDataStore();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1', scheduleRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    message: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  冰场磨冰车排程 API 已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
  console.log(`API 端点:`);
  console.log(`  POST   /api/v1/tasks           - 创建磨冰任务`);
  console.log(`  POST   /api/v1/tasks/:id/advance - 推进任务状态`);
  console.log(`  POST   /api/v1/tasks/:id/cancel - 撤回任务`);
  console.log(`  PATCH  /api/v1/tasks/:id       - 修正任务`);
  console.log(`  GET    /api/v1/tasks           - 查询任务汇总`);
  console.log(`  GET    /api/v1/tasks/:id       - 查询任务详情`);
  console.log(`  GET    /api/v1/rinks/:id/schedule - 查询冰面日程`);
  console.log(`  POST   /api/v1/system/reset    - 重置数据（测试用）`);
  console.log(`\n`);
});
