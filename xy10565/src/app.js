const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const dbManager = require('./db/database');

const masterRoutes = require('./routes/master.routes');
const replacementRoutes = require('./routes/replacement.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const recycleRoutes = require('./routes/recycle.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      name: config.app.name,
      version: config.app.version,
      status: 'running',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: config.app.name,
      version: config.app.version,
      description: '售后换新库存管理 API - 围绕故障判定、原机回收、换新库存和保修期重算展开',
      endpoints: {
        health: '/health',
        master: '/api/master',
        replacements: '/api/replacements',
        inventory: '/api/inventory',
        recycle: '/api/recycle'
      },
      statuses: config.business.status
    }
  });
});

app.use('/api/master', masterRoutes);
app.use('/api/replacements', replacementRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recycle', recycleRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路径 ${req.path} 不存在`
    },
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  await dbManager.initialize();

  const PORT = config.app.port;
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  ${config.app.name}`);
    console.log(`  版本: ${config.app.version}`);
    console.log(`  服务运行于: http://localhost:${PORT}`);
    console.log(`========================================\n`);
    console.log(`主要接口:`);
    console.log(`  GET  /health                  - 健康检查`);
    console.log(`  GET  /                        - API 信息`);
    console.log(`  GET  /api/replacements        - 换新申请列表`);
    console.log(`  POST /api/replacements        - 创建换新申请`);
    console.log(`  GET  /api/replacements/:id    - 申请详情`);
    console.log(`  GET  /api/replacements/:id/relation - 新旧机关系`);
    console.log(`  GET  /api/inventory/summary   - 库存汇总`);
    console.log(`  GET  /api/replacements/statistics - 统计数据`);
    console.log(`  GET  /api/replacements/risk-report - 风险报告`);
    console.log(`\n`);
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('启动服务失败:', err);
    process.exit(1);
  });
}

module.exports = app;
