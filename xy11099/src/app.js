const express = require('express');
const bodyParser = require('body-parser');
const rescheduleRoutes = require('./routes/reschedules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/reschedules', rescheduleRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '旅拍客服组旅拍路线改期 API 服务正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
========================================
  旅拍客服组旅拍路线改期 API 服务
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
========================================
    `);
  });
}

module.exports = app;