const express = require('express');
const ordersRouter = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now()
  });
});

app.use('/api/orders', ordersRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`配送路径 ETA API 服务器已启动`);
  console.log(`监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api/orders`);
});

module.exports = app;
