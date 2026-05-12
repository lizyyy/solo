const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./models/init');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDatabase();

const ordersRouter = require('./routes/orders');
const documentsRouter = require('./routes/documents');
const taxcodesRouter = require('./routes/taxcodes');
const customsRouter = require('./routes/customs');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/orders', ordersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/taxcodes', taxcodesRouter);
app.use('/api/customs', customsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cross-border-customs-api',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '跨境清关资料 API',
    version: '1.0.0',
    description: '跨境订单出库前报关资料校验系统',
    endpoints: {
      '订单管理': '/api/orders',
      '证件校验': '/api/documents',
      '税号维护': '/api/taxcodes',
      '清关流程': '/api/customs',
      '报告统计': '/api/reports',
      '健康检查': '/api/health'
    },
    quick_start: '运行 npm run seed 导入样例数据，然后查看 README.md'
  });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         跨境清关资料 API 已启动                             ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                          ║
║  健康检查: http://localhost:${PORT}/api/health              ║
║  API 文档: http://localhost:${PORT}/                        ║
╠════════════════════════════════════════════════════════════╣
║  快速开始:                                                  ║
║    1. npm run seed  - 导入样例税号和数据                    ║
║    2. npm run demo  - 运行自动化演示脚本                    ║
║    3. 查看 README.md 了解详细演示路径                       ║
╚════════════════════════════════════════════════════════════╝
  `);
});
