require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const sequelize = require('./config/database');

const itemsRouter = require('./routes/items');
const usersRouter = require('./routes/users');
const reservationsRouter = require('./routes/reservations');
const loansRouter = require('./routes/loans');
const waitlistsRouter = require('./routes/waitlists');
const reportsRouter = require('./routes/reports');

const ResponseHandler = require('./utils/responseHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

app.get('/', (req, res) => {
  return ResponseHandler.success(res, {
    name: '共享工具借还预约服务',
    version: '1.0.0',
    description: '一个用于小区、办公室或社团共享工具借还预约的后端API服务',
    endpoints: {
      items: '/api/items',
      users: '/api/users',
      reservations: '/api/reservations',
      loans: '/api/loans',
      waitlists: '/api/waitlists',
      reports: '/api/reports',
    },
    health: 'ok',
  });
});

app.get('/health', (req, res) => {
  return ResponseHandler.success(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/items', itemsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/waitlists', waitlistsRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message,
    }));
    return ResponseHandler.validationError(res, errors, '数据验证失败');
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: `${e.path}已存在`,
    }));
    return ResponseHandler.conflict(res, '数据冲突', '唯一约束违反');
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return ResponseHandler.notFound(res, '关联的资源不存在');
  }
  
  return ResponseHandler.error(res, err, err.message || '服务器内部错误', 500);
});

app.use((req, res) => {
  return ResponseHandler.notFound(res, '请求的端点不存在');
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功。');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('数据库模型同步完成。');
    } else {
      await sequelize.sync();
      console.log('数据库模型加载完成。');
    }
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API文档: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
