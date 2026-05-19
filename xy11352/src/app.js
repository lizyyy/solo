const express = require('express');
const cors = require('cors');
const config = require('./config');
const { logger } = require('./utils/logger');
const db = require('./models/database');

const appointmentsRouter = require('./routes/appointments');
const blacklistRouter = require('./routes/blacklist');
const platesRouter = require('./routes/plates');
const verificationRouter = require('./routes/verification');
const reportsRouter = require('./routes/reports');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (req, res, next) => {
  req.user = {
    id: 1,
    name: 'admin',
    role: 'admin'
  };
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '园区安保管理系统 API 服务',
    version: '1.0.0',
    endpoints: {
      appointments: '/api/appointments',
      blacklist: '/api/blacklist',
      plates: '/api/plates',
      verification: '/api/verification',
      reports: '/api/reports'
    }
  });
});

app.use('/api/appointments', appointmentsRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/plates', platesRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`API 文档: http://localhost:${PORT}`);
});

module.exports = app;
