const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mall_booth_system')
  .then(() => {
    console.log('MongoDB 连接成功');
  })
  .catch((err) => {
    console.error('MongoDB 连接失败:', err.message);
  });

const boothRoutes = require('./routes/booth.routes');
const merchantRoutes = require('./routes/merchant.routes');
const applicationRoutes = require('./routes/application.routes');
const depositRoutes = require('./routes/deposit.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const electricityRoutes = require('./routes/electricity.routes');
const acceptanceRoutes = require('./routes/acceptance.routes');
const reportRoutes = require('./routes/report.routes');

app.use('/api/booths', boothRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/electricity', electricityRoutes);
app.use('/api/acceptance', acceptanceRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '商场临时摊位管理系统后端运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
});