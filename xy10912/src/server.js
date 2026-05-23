const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { exceptionHandler, notFoundHandler } = require('./middleware/exceptionHandler');

const storesRouter = require('./routes/stores');
const productsRouter = require('./routes/products');
const priceVersionsRouter = require('./routes/priceVersions');
const promotionsRouter = require('./routes/promotions');
const confirmationsRouter = require('./routes/confirmations');
const discrepanciesRouter = require('./routes/discrepancies');
const exceptionsRouter = require('./routes/exceptions');
const correctionsRouter = require('./routes/corrections');
const exportsRouter = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./database/init');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: '连锁门店价签 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/stores', storesRouter);
app.use('/api/products', productsRouter);
app.use('/api/price-versions', priceVersionsRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/confirmations', confirmationsRouter);
app.use('/api/discrepancies', discrepanciesRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/corrections', correctionsRouter);
app.use('/api/exports', exportsRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '连锁门店价签 API',
    version: '1.0.0',
    endpoints: {
      stores: '/api/stores',
      products: '/api/products',
      price_versions: '/api/price-versions',
      promotions: '/api/promotions',
      confirmations: '/api/confirmations',
      discrepancies: '/api/discrepancies',
      exceptions: '/api/exceptions',
      corrections: '/api/corrections',
      exports: '/api/exports'
    }
  });
});

app.use(notFoundHandler);
app.use(exceptionHandler);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              连锁门店价签 API 服务已启动                       ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  API 文档: http://localhost:${PORT}/api                        ║
║  健康检查: http://localhost:${PORT}/api/health                 ║
║                                                               ║
║  数据库: SQLite (./data/pricetag.db)                          ║
║  数据持久化: 是                                               ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
