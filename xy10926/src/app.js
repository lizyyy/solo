const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const initDatabase = require('./utils/initDB');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const propertiesRouter = require('./routes/properties');
const tasksRouter = require('./routes/tasks');
const checkItemsRouter = require('./routes/checkItems');
const complaintsRouter = require('./routes/complaints');
const exportsRouter = require('./routes/exports');
const errorLogsRouter = require('./routes/errorLogs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

initDatabase();

app.use('/api/properties', propertiesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/check-items', checkItemsRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/error-logs', errorLogsRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '民宿保洁验收 API 运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用民宿保洁验收 API',
    endpoints: {
      properties: '/api/properties - 房源管理',
      tasks: '/api/tasks - 保洁任务管理',
      checkItems: '/api/check-items - 检查项管理',
      complaints: '/api/complaints - 客诉记录管理',
      exports: '/api/exports - 数据导出',
      errorLogs: '/api/error-logs - 错误日志管理',
      health: '/api/health - 健康检查'
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  民宿保洁验收 API 服务已启动`);
  console.log(`  运行地址: http://localhost:${PORT}`);
  console.log(`  API 文档: http://localhost:${PORT}/api`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});

module.exports = app;
