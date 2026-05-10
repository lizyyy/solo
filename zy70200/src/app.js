const express = require('express');
const path = require('path');
require('dotenv').config();

const sequelize = require('./config/database');
const employeesRouter = require('./routes/employees');
const probationRouter = require('./routes/probation');
const reportsRouter = require('./routes/reports');
const SalaryEffectWorker = require('./workers/salaryEffectWorker');
const apiDocs = require('./api-docs.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '试用期管理 API 服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.get('/api-docs', (req, res) => {
  res.json(apiDocs);
});

app.use('/api/employees', employeesRouter);
app.use('/api/probation', probationRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('错误:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '未找到请求的资源'
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');

    let salaryWorker;
    if (process.env.ENABLE_WORKERS !== 'false') {
      salaryWorker = new SalaryEffectWorker();
    }

    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API 文档: http://localhost:${PORT}/api-docs`);
    });

    const shutdown = async () => {
      console.log('正在关闭服务器...');
      if (salaryWorker) {
        salaryWorker.close();
      }
      await sequelize.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
