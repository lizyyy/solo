const express = require('express');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./config/schema');
const { errorHandler } = require('./utils/errors');

const roomsRouter = require('./routes/rooms');
const devicesRouter = require('./routes/devices');
const customersRouter = require('./routes/customers');
const bookingsRouter = require('./routes/bookings');
const exportsRouter = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'rehearsal-room-api'
    }
  });
});

app.use('/api/rooms', roomsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/exports', exportsRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Rehearsal Room API',
      version: '1.0.0',
      endpoints: {
        rooms: '/api/rooms',
        devices: '/api/devices',
        customers: '/api/customers',
        bookings: '/api/bookings',
        exports: '/api/exports'
      }
    }
  });
});

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `请求的路径 ${req.path} 不存在`
    }
  });
});

function startServer() {
  console.log('初始化数据库...');
  initDatabase();
  console.log('数据库初始化完成');
  
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Rehearsal Room API Server`);
    console.log(`  版本: 1.0.0`);
    console.log(`  运行端口: ${PORT}`);
    console.log(`========================================\n`);
    console.log(`API 端点:`);
    console.log(`  - GET  /api/health                    健康检查`);
    console.log(`  - GET  /api/rooms                     房间列表`);
    console.log(`  - POST /api/rooms                     创建房间`);
    console.log(`  - GET  /api/devices                   设备列表`);
    console.log(`  - POST /api/devices                   创建设备`);
    console.log(`  - GET  /api/customers                 客户列表`);
    console.log(`  - POST /api/customers                 创建客户`);
    console.log(`  - GET  /api/bookings                  预约列表`);
    console.log(`  - POST /api/bookings                  创建预约`);
    console.log(`  - GET  /api/exports/shift-handover    班次交接清单`);
    console.log(`  - GET  /api/exports/daily-reconciliation 日结对账单`);
    console.log(`  - GET  /api/exports/repair-todo       设备维修待办`);
    console.log(`\n导出格式参数: ?format=json|markdown|csv`);
    console.log(`\n服务器已启动: http://localhost:${PORT}`);
  });
}

startServer();

module.exports = app;
