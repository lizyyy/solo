const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('./database/init');
const noFlyRoutes = require('./routes/noFlyRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/no-fly', noFlyRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: '低空巡检平台-航线临时禁飞API' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║    🚁  低空巡检平台 - 航线临时禁飞 API                         ║
  ║                                                               ║
  ║    🚀  服务已启动: http://localhost:${PORT}                       ║
  ║                                                               ║
  ║    📡  API基础路径: /api/no-fly                                ║
  ║    💊  健康检查: /api/health                                   ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;