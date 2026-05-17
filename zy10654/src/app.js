require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const stockReservationRoutes = require('./routes/stockReservation');
app.use('/api/stock-reservation', stockReservationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`积分商城库存预占释放服务已启动`);
  console.log(`服务端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 接口列表:');
  console.log('  POST /api/stock-reservation/create     - 创建预占单');
  console.log('  POST /api/stock-reservation/reserve    - 预占库存');
  console.log('  POST /api/stock-reservation/release    - 释放库存');
  console.log('  POST /api/stock-reservation/exchange   - 兑换库存');
  console.log('  GET  /api/stock-reservation/list       - 查询列表');
  console.log('  GET  /api/stock-reservation/detail/:no - 查询详情');
  console.log('  GET  /api/stock-reservation/history/:no - 查询历史');
  console.log('  GET  /api/stock-reservation/export     - 导出数据');
  console.log('');
});

module.exports = app;
