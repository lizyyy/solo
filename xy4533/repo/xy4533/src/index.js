const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const artworksRouter = require('./routes/artworks');
const layersRouter = require('./routes/layers');
const processesRouter = require('./routes/processes');
const wetroomRouter = require('./routes/wetroom');
const reviewsRouter = require('./routes/reviews');
const violationsRouter = require('./routes/violations');
const importRouter = require('./routes/import');
const exportRouter = require('./routes/export');

const db = require('./database/database');
const violationChecker = require('./services/violationChecker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '非遗漆器湿房管理API',
    version: '1.0.0',
    endpoints: {
      artworks: '/api/artworks',
      layers: '/api/layers',
      processes: '/api/processes',
      wetroom: '/api/wetroom',
      reviews: '/api/reviews',
      violations: '/api/violations',
      import: '/api/import',
      export: '/api/export',
      health: '/api/health'
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const artworkCount = await db.get('SELECT COUNT(*) as count FROM artworks');
    const layerCount = await db.get('SELECT COUNT(*) as count FROM layers');
    const readingCount = await db.get('SELECT COUNT(*) as count FROM wetroom_readings');
    const violationCount = await db.get('SELECT COUNT(*) as count FROM violations WHERE resolved = 0');
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      statistics: {
        artworks: artworkCount.count,
        layers: layerCount.count,
        wetroom_readings: readingCount.count,
        unresolved_violations: violationCount.count
      },
      config: {
        process_order: violationChecker.PROCESS_ORDER,
        drying_hours: violationChecker.DRYING_HOURS,
        wetroom_limits: violationChecker.WETROOM_LIMITS
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: err.message
    });
  }
});

app.use('/api/artworks', artworksRouter);
app.use('/api/layers', layersRouter);
app.use('/api/processes', processesRouter);
app.use('/api/wetroom', wetroomRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/violations', violationsRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '端点不存在'
  });
});

app.listen(PORT, () => {
  console.log(`非遗漆器湿房管理API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('可用端点:');
  console.log('  GET  /api/artworks           - 获取作品列表');
  console.log('  POST /api/artworks           - 创建作品');
  console.log('  GET  /api/artworks/:id       - 获取作品详情');
  console.log('  PUT  /api/artworks/:id       - 更新作品');
  console.log('');
  console.log('  GET  /api/layers             - 获取漆层列表');
  console.log('  POST /api/layers             - 创建漆层');
  console.log('');
  console.log('  GET  /api/processes          - 获取工序列表');
  console.log('  POST /api/processes          - 创建工序');
  console.log('');
  console.log('  GET  /api/wetroom            - 获取湿房读数');
  console.log('  POST /api/wetroom            - 添加湿房读数');
  console.log('');
  console.log('  GET  /api/violations         - 获取违规记录');
  console.log('  POST /api/violations/check   - 执行违规检查');
  console.log('');
  console.log('  POST /api/import/orders      - 导入订单CSV');
  console.log('  POST /api/import/wetroom     - 导入湿房JSON');
  console.log('  POST /api/import/layers      - 导入漆层工序CSV');
  console.log('  POST /api/import/handover    - 导入交接备注');
  console.log('');
  console.log('  GET  /api/export/handover/:id - 导出交接单(Markdown)');
  console.log('  GET  /api/export/audit       - 导出审计包(JSON)');
});
