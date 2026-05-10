const express = require('express');
const { initDatabase, saveDatabase } = require('./db/database');
const { initSchema } = require('./db/schema');

const receivableRoutes = require('./routes/receivableRoutes');
const agingRoutes = require('./routes/agingRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const reportRoutes = require('./routes/reportRoutes');

async function startServer() {
  await initDatabase();
  initSchema();
  
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  app.use(express.json());
  
  app.use('/api/receivable', receivableRoutes);
  app.use('/api/aging', agingRoutes);
  app.use('/api/collection', collectionRoutes);
  app.use('/api/reports', reportRoutes);
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  });
  
  process.on('SIGINT', () => {
    saveDatabase();
    console.log('\n数据库已保存');
    process.exit(0);
  });
  
  app.listen(PORT, () => {
    console.log(`应收账龄催收服务运行在 http://localhost:${PORT}`);
    console.log('API 端点:');
    console.log('  - 健康检查: GET /health');
    console.log('  - 应收模块: /api/receivable/*');
    console.log('  - 账龄模块: /api/aging/*');
    console.log('  - 催收模块: /api/collection/*');
    console.log('  - 报表模块: /api/reports/*');
  });
  
  return app;
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
