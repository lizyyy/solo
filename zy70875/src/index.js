const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initDatabase } = require('./utils/database');

const batchesRouter = require('./routes/batches');
const tasksRouter = require('./routes/tasks');
const auditRouter = require('./routes/audit');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/audit', auditRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '影院排片补贴核算API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`影院排片补贴核算API服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
