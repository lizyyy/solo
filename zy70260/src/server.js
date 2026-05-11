const express = require('express');
const { initDatabase } = require('./database');
const { errorHandler } = require('./middleware/error');
const { STATUS } = require('./utils');

const windSpeedRoutes = require('./routes/windSpeed');
const scheduleRoutes = require('./routes/schedule');
const ticketRoutes = require('./routes/ticket');
const historyRoutes = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '景区索道风速停运API',
    version: '1.0.0',
    description: '景区索道遇到风速预警时，已购票游客、班次和退改规则同步处理系统',
    endpoints: {
      wind_speed: '/api/wind-speed',
      schedule: '/api/schedule',
      ticket: '/api/ticket',
      history: '/api/history'
    },
    status_enums: STATUS
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/wind-speed', windSpeedRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/history', historyRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

function startServer() {
  initDatabase();
  
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  景区索道风速停运API 服务启动成功`);
    console.log(`========================================`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API文档: http://localhost:${PORT}/`);
    console.log(`========================================\n`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
