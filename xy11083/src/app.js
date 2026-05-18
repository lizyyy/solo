const express = require('express');
const bodyParser = require('body-parser');
const accidentRoutes = require('./routes/accidentRoutes');
const testDriveRoutes = require('./routes/testDriveRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '汽车试驾中心试驾事故登记API',
    version: '1.0.0',
    description: '支持种子数据、异常样例、时间校验、一致性检查的事故登记系统',
    endpoints: {
      testDrives: {
        list: 'GET /api/test-drives',
        create: 'POST /api/test-drives',
        get: 'GET /api/test-drives/:id',
        update: 'PUT /api/test-drives/:id'
      },
      accidents: {
        list: 'GET /api/accidents',
        create: 'POST /api/accidents',
        get: 'GET /api/accidents/:id',
        update: 'PUT /api/accidents/:id',
        review: 'POST /api/accidents/:id/review'
      }
    },
    usage: {
      init: '运行 npm run init 初始化种子数据',
      test_normal: '运行 npm run test:normal 测试正常流程',
      test_conflict: '运行 npm run test:conflict 测试冲突流程',
      start_server: '运行 npm start 启动服务器'
    }
  });
});

app.use('/api/accidents', accidentRoutes);
app.use('/api/test-drives', testDriveRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: '接口不存在'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
========================================
汽车试驾中心试驾事故登记API
服务器运行在 http://localhost:${PORT}
========================================

可用命令:
- npm run init          # 初始化数据库和种子数据
- npm start             # 启动服务器
- npm run test:normal   # 测试正常单流程
- npm run test:conflict # 测试冲突单流程
    `);
  });
}

module.exports = app;
