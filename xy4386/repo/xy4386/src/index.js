const express = require('express');
const config = require('./config');
const store = require('./data/store');

const importRoutes = require('./routes/importRoutes');
const riskRoutes = require('./routes/riskRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const PORT = config.server.port;
const HOST = config.server.host;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/', (req, res) => {
  res.json({
    name: '档案馆低氧库房管理后端服务',
    version: '1.0.0',
    description: '开库放行系统 - 用于低氧库房开库前风险检测与放行审批',
    endpoints: {
      import: {
        warehouse: 'POST /api/import/warehouse - 导入库房氧浓度/温湿度 CSV',
        accessControl: 'POST /api/import/access-control - 导入门禁维修 JSON',
        retrieval: 'POST /api/import/retrieval - 导入调阅单 (CSV 或 JSON)',
        all: 'POST /api/import/all - 批量导入所有类型数据'
      },
      risk: {
        recalculate: 'POST /api/risk/recalculate - 重新计算所有风险',
        list: 'GET /api/risk - 获取风险清单 (支持筛选)',
        detail: 'GET /api/risk/:riskId - 获取风险详情',
        summary: 'GET /api/risk/summary - 获取风险统计摘要'
      },
      review: {
        create: 'POST /api/review - 人工改判/复核风险',
        list: 'GET /api/review - 获取复核记录列表',
        summary: 'GET /api/review/summary - 获取复核统计摘要',
        detail: 'GET /api/review/:reviewId - 获取复核记录详情'
      },
      export: {
        markdown: 'GET /api/export/markdown - 导出 Markdown 开库放行单',
        json: 'GET /api/export/json - 导出 JSON 审计包',
        both: 'GET /api/export/both - 同时导出两种格式',
        decision: 'GET /api/export/release-decision - 获取开库放行结论'
      }
    }
  });
});

app.use('/api/import', importRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  const warehouses = store.getAllWarehouses();
  const tasks = store.getAllTasks();
  const risks = store.getAllRisks();
  const reviews = store.getAllReviews();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dataSummary: {
      warehouses: warehouses.length,
      tasks: tasks.length,
      risks: risks.length,
      reviews: reviews.length
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
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

app.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log('  档案馆低氧库房管理后端服务');
  console.log('========================================');
  console.log(`服务已启动: http://${HOST}:${PORT}`);
  console.log(`API 文档: http://${HOST}:${PORT}/`);
  console.log(`健康检查: http://${HOST}:${PORT}/api/health`);
  console.log('========================================');
});

module.exports = app;
