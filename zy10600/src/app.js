const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '电商开放平台商家回调签名轮换 API' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('健康检查: http://localhost:${PORT}/health');
  console.log('API 文档');
  console.log('  POST /api/rotations - 创建轮换记录');
  console.log('  PUT /api/rotations/:id - 修改轮换记录');
  console.log('  POST /api/rotations/:id/gray - 开始灰度');
  console.log('  POST /api/rotations/:id/approve - 审核切换');
  console.log('  POST /api/rotations/:id/rollback - 回滚');
  console.log('  GET /api/rotations - 获取列表');
  console.log('  GET /api/rotations/:id - 获取详情');
  console.log('  GET /api/rotations/:id/history - 获取历史');
  console.log('  GET /api/export - 导出CSV');
  console.log('  POST /api/callback-retry - 记录回调重试(内部使用)');
});
