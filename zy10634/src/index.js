const express = require('express');
const bodyParser = require('body-parser');
const compensationRoutes = require('./routes/compensations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/compensations', compensationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
=========================================
配送算法后台骑手改派补偿API服务已启动
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health
API地址: http://localhost:${PORT}/api/compensations
=========================================
  `);
});

module.exports = app;
