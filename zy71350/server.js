const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const apiRoutes = require('./routes/api');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      service: '画廊寄售结算表服务',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        config: '/api/config',
        artists: '/api/artists',
        batches: '/api/batches',
        imports: '/api/import/json, /api/import/csv'
      }
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(config.PORT, () => {
  console.log('='.repeat(50));
  console.log('  画廊寄售结算表服务已启动');
  console.log(`  服务地址: http://localhost:${config.PORT}`);
  console.log(`  健康检查: http://localhost:${config.PORT}/api/health`);
  console.log(`  API文档: http://localhost:${config.PORT}/api/config`);
  console.log('='.repeat(50));
  console.log('');
  console.log('快速开始:');
  console.log('  1. 初始化数据库: npm run init-db');
  console.log('  2. 处理样例数据: npm run test-sample');
  console.log('  3. 启动服务: npm start');
  console.log('');
});

module.exports = app;
