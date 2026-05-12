const express = require('express');
const { sequelize } = require('./models');
const { errorHandler } = require('./middleware/errorHandler');

const meetingRoomsRouter = require('./routes/meetingRooms');
const equipmentRouter = require('./routes/equipment');
const bookingsRouter = require('./routes/bookings');
const inspectionsRouter = require('./routes/inspections');
const damageReportsRouter = require('./routes/damageReports');
const liabilityRouter = require('./routes/liability');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-operator-id, x-operator-name');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '会议室设备损坏追责系统 API',
    version: '1.0.0',
    endpoints: {
      '/api/meeting-rooms': '会议室管理',
      '/api/equipment': '设备管理',
      '/api/bookings': '预约管理',
      '/api/inspections': '会前会后检查',
      '/api/damage-reports': '损坏报告',
      '/api/liability/confirmations': '责任确认',
      '/api/liability/compensations': '赔付管理',
      '/api/liability/compensations/export': '导出待处理赔付列表'
    }
  });
});

app.use('/api/meeting-rooms', meetingRoomsRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/damage-reports', damageReportsRouter);
app.use('/api/liability', liabilityRouter);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'ENDPOINT_NOT_FOUND',
    message: '请求的接口不存在'
  });
});

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    await sequelize.sync({ force: false });
    console.log('数据库同步完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
