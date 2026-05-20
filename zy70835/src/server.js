const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const batchRoutes = require('./routes/batchRoutes');
const checkRoutes = require('./routes/checkRoutes');
const exportRoutes = require('./routes/exportRoutes');

require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchRoutes);
app.use('/api/checks', checkRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '幼儿园晨检异常追踪API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用幼儿园晨检异常追踪API服务',
    endpoints: {
      batches: '/api/batches',
      checks: '/api/checks',
      export: '/api/export',
      health: '/api/health'
    }
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('幼儿园晨检异常追踪API服务已启动');
});

module.exports = app;