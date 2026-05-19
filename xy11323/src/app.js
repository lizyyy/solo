const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');
const samplesDir = path.join(__dirname, '../samples');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

require('./config/database');
require('./scripts/initDb');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '农机计费系统运行正常' });
});

app.get('/api/docs', (req, res) => {
  res.json({
    导入接口: [
      { method: 'POST', url: '/api/import/work-orders', description: '导入作业单 CSV' },
      { method: 'POST', url: '/api/import/fuel-records', description: '导入油耗表 JSON' },
      { method: 'POST', url: '/api/import/rate-configs', description: '导入费率表 CSV' }
    ],
    查询接口: [
      { method: 'GET', url: '/api/batches', description: '获取所有导入批次' },
      { method: 'GET', url: '/api/work-orders', description: '获取所有作业单（可加 ?batch_id=1 过滤）' },
      { method: 'GET', url: '/api/fuel-records', description: '获取所有油耗记录' },
      { method: 'GET', url: '/api/rate-configs', description: '获取所有费率配置' },
      { method: 'GET', url: '/api/error-records', description: '获取所有错误记录（?unfixed=1 获取未修复）' },
      { method: 'GET', url: '/api/operation-logs', description: '获取操作日志' }
    ],
    复核和修改接口: [
      { method: 'PUT', url: '/api/work-orders/:id', description: '修改作业单' },
      { method: 'POST', url: '/api/work-orders/:id/approve', description: '复核通过作业单' },
      { method: 'POST', url: '/api/error-records/:id/fix', description: '修复错误记录并转为正常记录' }
    ],
    导出接口: [
      { method: 'GET', url: '/api/work-orders/export', description: '导出作业单为 CSV' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`
=========================================
  农机计费系统已启动
  服务地址: http://localhost:${PORT}
  API 文档: http://localhost:${PORT}/api/docs
  健康检查: http://localhost:${PORT}/api/health
=========================================
  `);
});

module.exports = app;