const express = require('express');
const rectificationRoutes = require('./routes/rectification');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/rectification', rectificationRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '便利店加盟督导巡店整改API',
    version: '1.0.0',
    description: '支持导入、冲突处理、人工备注的巡店整改管理系统',
    endpoints: {
      import: 'POST /api/rectification/import',
      getImportErrors: 'GET /api/rectification/import-errors/:batchId',
      resolveConflict: 'POST /api/rectification/resolve-conflict',
      updateStatus: 'POST /api/rectification/update-status',
      getItem: 'GET /api/rectification/item/:itemId',
      health: 'GET /api/rectification/health'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    detail: err.message
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   便利店加盟督导巡店整改API 服务已启动                        ║
║                                                              ║
║   服务地址: http://localhost:${PORT}                           ║
║   API文档:  http://localhost:${PORT}/                          ║
║                                                              ║
║   验收流程:                                                   ║
║   1. npm run init     - 初始化数据库                         ║
║   2. npm start        - 启动服务                              ║
║   3. npm run test:all - 运行完整验收测试                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

module.exports = app;