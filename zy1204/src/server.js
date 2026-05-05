require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const routes = require('./routes');
const { syncDatabase } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const publicPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

app.use('/', routes);

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      success: true,
      message: '接口保护策略复盘台 API',
      endpoints: {
        health: '/api/health',
        stats: '/api/stats',
        experiments: '/api/experiments',
        policies: '/api/policies',
        traces: '/api/traces'
      }
    });
  }
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({
    success: false,
    message: NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

async function startServer() {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    await syncDatabase(false);
    
    app.listen(PORT, () => {
      console.log(`服务器启动成功，端口: ${PORT}`);
      console.log(`环境: ${NODE_ENV}`);
      console.log(`API 地址: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
