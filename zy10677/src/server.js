const express = require('express');
const leaseRoutes = require('./routes/leaseRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use('/api/leases', leaseRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '设备租赁平台押金分阶段退还 API 运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`
=============================================
  设备租赁平台押金分阶段退还 API
=============================================
  服务器运行在: http://localhost:${PORT}
  健康检查: GET http://localhost:${PORT}/api/health
  
  主要接口:
  - 租赁单列表: GET /api/leases
  - 创建租赁单: POST /api/leases
  - 租赁单详情: GET /api/leases/:id
  - 历史记录: GET /api/leases/:id/history
  - 开始验收: POST /api/leases/:id/start-inspection
  - 发起退款: POST /api/leases/:id/refund
  - 驳回退款: POST /api/leases/refund-batches/:batchId/reject
  - 导出CSV: GET /api/leases/export/csv
  - 导出JSON: GET /api/leases/export/json
  - 导入数据: POST /api/leases/import
=============================================
  `);
});
