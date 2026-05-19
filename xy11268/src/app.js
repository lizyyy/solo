const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const callRoutes = require('./routes/calls');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/calls', callRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '客服质检服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  GET  /api/health          - 健康检查');
  console.log('  POST /api/calls/import    - 批量导入通话记录');
  console.log('  GET  /api/calls           - 查询通话记录（支持筛选）');
  console.log('  GET  /api/calls/export    - 导出通话记录CSV');
  console.log('  GET  /api/calls/:id       - 获取通话详情');
  console.log('  PUT  /api/calls/:id/review - 复核通话记录');
  console.log('  POST /api/calls/batch-review - 批量复核');
  console.log('  GET  /api/calls/batch/:id - 查询批量操作结果');
  console.log('  POST /api/users           - 创建用户');
  console.log('  GET  /api/users           - 获取所有用户');
});
