const express = require('express');
const bodyParser = require('body-parser');
const orderRoutes = require('./routes/orders');
const verificationRoutes = require('./routes/verifications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/orders', orderRoutes);
app.use('/api/verifications', verificationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '蛋糕预订台取货核验API运行正常' });
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 蛋糕预订台取货核验API已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
