const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const importRoutes = require('./routes/import');
const recordRoutes = require('./routes/records');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/import', importRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Hospital Bed Management System',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>住院床位管理系统</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2c3e50; }
        .endpoint { background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .method { font-weight: bold; color: #27ae60; }
        .url { color: #2980b9; }
      </style>
    </head>
    <body>
      <h1>🏥 住院床位管理系统 API</h1>
      <p>后端服务已启动，运行在端口 ${PORT}</p>
      
      <h2>主要接口:</h2>
      
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/health</span> - 健康检查
      </div>
      
      <h3>导入接口:</h3>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/import/beds</span> - 导入床位CSV
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/import/patient-transfers</span> - 导入患者流转JSON
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/import/cleaning-orders</span> - 导入保洁工单
      </div>
      
      <h3>记录处理接口:</h3>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/records/process-transfer</span> - 处理患者转科
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/records/:id/approve</span> - 批准记录
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/records/:id/reject</span> - 驳回记录
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <span class="url">/api/records/:id/send-back</span> - 退回修改
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/records/:id</span> - 查询记录详情
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/records/:id/audit-trail</span> - 审计追踪
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/records/</span> - 查询记录列表
      </div>
      
      <h3>导出接口:</h3>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/export/records</span> - 导出追踪记录
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/export/beds</span> - 导出床位状态
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/export/cleaning-orders</span> - 导出保洁工单
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <span class="url">/api/export/patient-outcome</span> - 导出患者转归
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🏥 住院床位管理系统已启动，运行在 http://localhost:${PORT}`);
  console.log(`📋 初始化数据库请运行: npm run init-db`);
  console.log(`📖 API文档请访问: http://localhost:${PORT}`);
});

module.exports = app;
