const express = require('express');
const bodyParser = require('body-parser');
const degradeRoutes = require('./routes/degradeRoutes');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/cache', degradeRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '缓存管理后台热点Key手工降级API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
============================================
缓存管理后台热点Key手工降级API已启动
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health
============================================
  `);
});

module.exports = app;