const express = require('express');
const bodyParser = require('body-parser');
const importRoutes = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/import', importRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '家电安装队安装师傅抢单API服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '家电安装队安装师傅抢单API',
    version: '1.0.0',
    endpoints: {
      import: {
        json: 'POST /api/import/json - JSON格式导入订单',
        csv: 'POST /api/import/csv - CSV文件导入订单',
        batches: 'GET /api/import/batches - 获取所有导入批次',
        batchDetail: 'GET /api/import/batches/:batchId - 获取批次详情',
        review: 'POST /api/import/review/:orderId - 人工审核处理',
        pendingReview: 'GET /api/import/review/pending - 获取待审核订单'
      },
      orders: {
        list: 'GET /api/import/orders - 获取订单列表',
        detail: 'GET /api/import/orders/:orderId - 获取订单详情',
        updateStatus: 'PUT /api/import/orders/:orderId/status - 更新订单状态'
      }
    }
  });
});

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
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   家电安装队安装师傅抢单API - 导入接口系统                 ║
║                                                              ║
║   服务地址: http://localhost:${PORT}                           ║
║   健康检查: http://localhost:${PORT}/api/health                 ║
║   API文档:  http://localhost:${PORT}/api                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
