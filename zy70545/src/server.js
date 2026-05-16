const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`用户数据导入审计服务启动成功`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 端点:');
  console.log('  POST   /api/batches              - 创建导入批次');
  console.log('  GET    /api/batches              - 查询批次列表');
  console.log('  GET    /api/batches/:id          - 查询批次详情');
  console.log('  PATCH  /api/batches/:id/status   - 更新批次状态');
  console.log('  GET    /api/batches/:id/rows     - 查询批次原始行');
  console.log('  POST   /api/batches/:id/rows/:rowId/correct - 人工修正');
  console.log('  POST   /api/batches/:id/conflicts - 添加冲突记录');
  console.log('  PATCH  /api/conflicts/:id/resolve - 裁决冲突');
  console.log('  POST   /api/batches/:id/process   - 处理批次');
  console.log('  GET    /api/batches/:id/report    - 导出审计报告');
});
