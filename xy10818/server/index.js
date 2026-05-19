const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const idempotencyMiddleware = require('./middleware/idempotency');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(idempotencyMiddleware);

app.use('/api', routes);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message,
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`
========================================
  事件订阅偏好中心 API 服务已启动
  服务地址: http://localhost:${PORT}
  API 前缀: http://localhost:${PORT}/api
  健康检查: http://localhost:${PORT}/api/health
========================================
  `);
});
