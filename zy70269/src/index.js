const express = require('express');
const { initSampleData } = require('./models/storage');

const app = express();
const PORT = 3001;

app.use(express.json());

const stopsRouter = require('./routes/stops');
const reportsRouter = require('./routes/reports');

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'bus-stop-report-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/stops', stopsRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务内部错误'
    }
  });
});

initSampleData();

app.listen(PORT, () => {
  console.log(`公交站牌破损上报 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('可用 API:');
  console.log('  POST /api/stops/verify      - 验证站牌档案');
  console.log('  POST /api/reports        - 提交破损上报');
  console.log('  GET  /api/reports/:id    - 查询上报记录');
  console.log('  POST /api/reports/:id/retry - 重试上报');
  console.log('');
  console.log('测试队伍 ID:');
  console.log('  TEAM-MAINT - 设施维护队 (可上报: 站牌破损)');
  console.log('  TEAM-ROUTE - 线路管理队 (可上报: 线路变更)');
  console.log('  TEAM-AD    - 广告巡查队 (可上报: 广告位遮挡)');
  console.log('');
  console.log('测试站牌 ID: STOP-001, STOP-002');
  console.log('测试线路 ID: ROUTE-01 (v3), ROUTE-02 (v1), ROUTE-03 (v2)');
});

module.exports = app;
