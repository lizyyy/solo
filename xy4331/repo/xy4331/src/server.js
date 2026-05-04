const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { initTables } = require('./config/initDB');
const importRoutes = require('./routes/importRoutes');
const queryRoutes = require('./routes/queryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/import', importRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/export', exportRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '笼位健康事件仲裁器',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '笼位健康事件仲裁器',
    version: '1.0.0',
    description: '高校实验动物房后端API服务',
    endpoints: {
      import: {
        description: '数据导入接口',
        endpoints: [
          'POST /api/import/sensor-alerts - 导入传感器告警JSON',
          'POST /api/import/transfer-records - 导入转笼记录CSV',
          'POST /api/import/veterinary-orders - 导入兽医处置单',
          'POST /api/import/care-inspections - 导入饲养员巡检记录',
          'POST /api/import/animals - 导入动物数据',
          'POST /api/import/cages - 导入笼位数据'
        ]
      },
      query: {
        description: '数据查询接口',
        endpoints: [
          'GET /api/query/animals - 查询动物列表',
          'GET /api/query/animals/:animalId - 查询动物详情',
          'GET /api/query/cages - 查询笼位列表',
          'GET /api/query/alerts - 查询告警列表',
          'GET /api/query/alerts/open - 查询未闭环告警',
          'GET /api/query/transfers/pending - 查询待处理转笼',
          'GET /api/query/veterinary-orders/unsigned - 查询待签署处置单',
          'GET /api/query/veterinary-orders/observing - 查询观察中处置单',
          'GET /api/query/violations/open - 查询待处理违规',
          'GET /api/query/dashboard - 查询仪表板汇总数据',
          'POST /api/query/rules/run-all - 运行所有校验规则'
        ]
      },
      review: {
        description: '复核与状态管理接口',
        endpoints: [
          'POST /api/review/violations/:violationId/review - 复核违规记录',
          'POST /api/review/violations/batch-review - 批量复核违规',
          'POST /api/review/alerts/:alertId/acknowledge - 确认告警',
          'POST /api/review/alerts/:alertId/resolve - 解决告警',
          'POST /api/review/transfers/:transferId/execute - 执行转笼',
          'POST /api/review/veterinary-orders/:orderId/sign - 签署处置单',
          'POST /api/review/veterinary-orders/:orderId/start-observation - 开始观察期',
          'POST /api/review/veterinary-orders/:orderId/complete-observation - 完成观察期',
          'POST /api/review/animals/:animalId/merge-timeline - 合并动物时间线',
          'POST /api/review/resolve-transfer-duplicate - 解决重复转笼冲突'
        ]
      },
      export: {
        description: '数据导出接口',
        endpoints: [
          'GET /api/export/markdown/review - 下载Markdown复盘报告',
          'GET /api/export/csv/risk-list - 下载风险清单CSV',
          'GET /api/export/csv/alerts - 下载告警CSV',
          'GET /api/export/csv/transfers - 下载转笼记录CSV',
          'GET /api/export/csv/veterinary-orders - 下载处置单CSV',
          'GET /api/export/csv/animals - 下载动物CSV',
          'GET /api/export/csv/cages - 下载笼位状态CSV',
          'GET /api/export/json/audit-package - 下载JSON审计包',
          'GET /api/export/json/animal-audit/:animalId - 下载单动物审计记录'
        ]
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    success: false
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    availableEndpoints: [
      'GET /health - 健康检查',
      'GET / - API文档'
    ]
  });
});

const startServer = async () => {
  try {
    console.log('正在初始化数据库...');
    await initTables();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log('============================================');
      console.log('  笼位健康事件仲裁器 服务已启动');
      console.log('============================================');
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`API文档: http://localhost:${PORT}/`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log('============================================');
      console.log('数据目录:', dataDir);
      console.log('上传目录:', uploadsDir);
      console.log('============================================');
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
