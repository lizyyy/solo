const express = require('express');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./database/db');

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`
==============================================
  社区食堂管理系统 API 服务器已启动
  本地地址: http://localhost:${PORT}
  数据库: SQLite (data/canteen.db)
==============================================
  
  API 接口说明:
  - GET  /api              - API 概览
  - GET  /api/elderly      - 获取老人列表
  - POST /api/elderly      - 添加老人
  - GET  /api/menu/items   - 获取菜品列表
  - GET  /api/deliveries   - 获取配送列表
  - POST /api/import/elderly - 导入老人CSV
  - POST /api/import/menu    - 导入菜单JSON
  - GET  /api/report/delivery/export - 导出配送报告
  - GET  /api/history      - 查看操作历史
  
  `);
});

module.exports = app;
