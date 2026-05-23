const express = require('express');
const cors = require('cors');
const appConfig = require('../config/app');
const { exceptionHandler } = require('./middleware/exceptionLogger');

const memberRoutes = require('./routes/member');
const stationRoutes = require('./routes/station');
const queueRoutes = require('./routes/queue');
const appointmentRoutes = require('./routes/appointment');
const reportRoutes = require('./routes/report');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '洗车会员排队API服务运行正常', timestamp: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      serviceTypes: appConfig.serviceTypes,
      queueStatuses: appConfig.queueStatuses,
      appointmentStatuses: appConfig.appointmentStatuses,
      stationStatuses: appConfig.stationStatuses
    }
  });
});

app.use('/api/members', memberRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);

app.use(exceptionHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

const PORT = appConfig.port;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚗 洗车会员排队API服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});

module.exports = app;
