const express = require('express');
const riskRoutes = require('./routes/risks');
const failedOperationRoutes = require('./routes/failedOperations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'project-risk-registry'
    }
  });
});

app.use('/api/risks', riskRoutes);
app.use('/api/failed-operations', failedOperationRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
========================================
  项目风险登记API服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
========================================

可用接口:
  POST   /api/risks                    - 创建风险记录
  GET    /api/risks                    - 查询风险列表
  GET    /api/risks/statuses           - 获取状态定义和转换规则
  GET    /api/risks/:id                - 查询单个风险详情
  GET    /api/risks/:id/history        - 查询风险状态变更历史
  POST   /api/risks/:id/transition     - 推进风险状态
  PATCH  /api/risks/:id/correct        - 人工修正风险信息
  GET    /api/risks/export/csv         - 导出CSV格式
  GET    /api/risks/export/json        - 导出JSON格式

  GET    /api/failed-operations        - 查询失败操作记录
  GET    /api/failed-operations/:id    - 查询单个失败操作详情
  PATCH  /api/failed-operations/:id/resolve - 处理失败操作
  `);
});
