const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const ordersRouter = require('./routes/orders');
const wavesRouter = require('./routes/waves');
const inventoryRouter = require('./routes/inventory');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: 'Warehouse Stockout Split API',
    version: '1.0.0',
    description: '仓配波次缺货拆单 API',
    endpoints: {
      orders: '/api/orders',
      waves: '/api/waves',
      inventory: '/api/inventory',
      reports: '/api/reports'
    },
    usage: {
      startup: 'npm run init-db && npm run seed && npm start',
      demo: 'curl -X POST http://localhost:3000/api/waves -H "Content-Type: application/json" -d \'{"warehouse_code": "WH-SH", "wave_no": "W001"}\''
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/orders', ordersRouter);
app.use('/api/waves', wavesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   Warehouse Stockout Split API v1.0.0                     ║
╠════════════════════════════════════════════════════════════╣
║   Server running on port ${PORT}                          ║
║   Base URL: http://localhost:${PORT}                      ║
╠════════════════════════════════════════════════════════════╣
║   仓库波次缺货拆单 API                                    ║
║   功能: 拆单、换仓、保留、状态回写、报告导出             ║
╠════════════════════════════════════════════════════════════╣
║   初始化命令:                                              ║
║     npm run init-db  # 初始化数据库                       ║
║     npm run seed     # 加载样例数据                       ║
║     npm start        # 启动服务                           ║
╚════════════════════════════════════════════════════════════╝
  `);
});
