require('dotenv').config();
const express = require('express');
const cors = require('cors');
const archiveRoutes = require('./routes/archiveRoutes');
const statsRoutes = require('./routes/statsRoutes');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/archives', archiveRoutes);
app.use('/api/stats', statsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

async function startServer() {
  try {
    await db.query('SELECT 1');
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`慢接口自动归档服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API 文档参考: http://localhost:${PORT}/api/archives`);
    });
  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
}

startServer();
