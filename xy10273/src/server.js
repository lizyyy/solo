const express = require('express');
const { initTables } = require('./config/database');
const activitiesRouter = require('./routes/activities');
const batchesRouter = require('./routes/batches');
const complaintsRouter = require('./routes/complaints');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/activities', activitiesRouter);
app.use('/api/v1', batchesRouter);
app.use('/api/v1', complaintsRouter);

app.use((err, req, res, next) => {
  console.error('未处理的错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误', code: 'INTERNAL_ERROR' });
});

const startServer = async () => {
  try {
    await initTables();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  门店试吃样品留样 API 服务已启动`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/health`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
};

startServer();

module.exports = app;
