const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const itemRoutes = require('./routes/itemRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', itemRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '公交失物招领服务运行正常' });
});

app.get('/', (req, res) => {
  res.json({
    name: '公交客服中心失物招领后端服务',
    version: '1.0.0',
    description: '支持失物CSV导入、线路班次JSON导入、可追踪记录管理',
    endpoints: {
      batches: '/api/batches - 批次管理',
      upload: '/api/upload/* - 文件上传',
      items: '/api/items - 物品管理',
      vouchers: '/api/vouchers - 领取凭证管理',
      query: '/api/query/* - 查询接口',
      export: '/api/export - 导出接口',
      tasks: '/api/tasks/* - 任务接口'
    }
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档: http://localhost:${PORT}/`);
});

module.exports = app;
