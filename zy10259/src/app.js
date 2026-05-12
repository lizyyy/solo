require('dotenv').config();
const express = require('express');
const db = require('./models/database');

const equipmentRoutes = require('./routes/equipment');
const orderRoutes = require('./routes/orders');
const extensionRoutes = require('./routes/extensions');
const outboundRoutes = require('./routes/outbounds');
const exchangeRoutes = require('./routes/exchanges');
const returnRoutes = require('./routes/returns');
const depositRoutes = require('./routes/deposits');
const billRoutes = require('./routes/bills');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '设备租赁 API 服务运行正常' });
});

app.use('/api/equipment', equipmentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/outbounds', outboundRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/bills', billRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('健康检查: GET /health');
  console.log('API 文档请参考 README.md');
});

module.exports = app;
