const express = require('express');
const bodyParser = require('body-parser');
const deprecationRoutes = require('./routes/deprecation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/deprecation', deprecationRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'data-lineage-field-deprecation-api'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`数据血缘服务字段下线订阅通知 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 端点:');
  console.log('  POST /api/deprecation/import      - 批量导入血缘影响');
  console.log('  POST /api/deprecation/:id/confirm - 逐个确认');
  console.log('  POST /api/deprecation/:id/revoke  - 撤回下线');
  console.log('  GET  /api/deprecation/validate-publish - 发布校验');
  console.log('  GET  /api/deprecation/            - 查询记录');
  console.log('  GET  /api/deprecation/statistics  - 统计信息');
  console.log('  GET  /api/deprecation/export      - 导出CSV');
  console.log('  GET  /api/deprecation/:id         - 查询单条记录');
});

module.exports = app;