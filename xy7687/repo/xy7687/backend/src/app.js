const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const ticketsRouter = require('./routes/tickets');
const csvRouter = require('./routes/csv');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/tickets', ticketsRouter);
app.use('/api/csv', csvRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误' 
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在' 
  });
});

app.listen(PORT, () => {
  console.log(`维修工单系统后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API文档: `);
  console.log(`  - GET  /api/health          - 健康检查`);
  console.log(`  - GET  /api/tickets         - 获取工单列表`);
  console.log(`  - GET  /api/tickets/kanban  - 获取看板数据`);
  console.log(`  - GET  /api/tickets/:id     - 获取工单详情`);
  console.log(`  - POST /api/tickets         - 创建工单`);
  console.log(`  - PUT  /api/tickets/:id     - 更新工单`);
  console.log(`  - POST /api/tickets/:id/transition - 状态流转`);
  console.log(`  - GET  /api/csv/export      - 导出CSV`);
  console.log(`  - POST /api/csv/import      - 导入CSV`);
  console.log(`  - GET  /api/csv/template    - 下载导入模板`);
});

module.exports = app;
