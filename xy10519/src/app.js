const express = require('express');
const cors = require('cors');
const path = require('path');

const orderRoutes = require('./routes/orderRoutes');
const dataRoutes = require('./routes/dataRoutes');

const app = express();
const PORT = process.env.PORT || 3080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/orders', orderRoutes);
app.use('/api/data', dataRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '课程优惠叠加 API 运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  课程优惠叠加 API');
  console.log('========================================');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`演示页面: http://localhost:${PORT}`);
  console.log('========================================');
  console.log('启动时间:', new Date().toLocaleString());
});
