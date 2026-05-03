const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// 导入配置和模型
const { sequelize } = require('./models');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares');

// 创建 Express 应用
const app = express();

// 中间件配置
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志配置
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // 生产环境写入日志文件
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
}

// API 路由
app.use('/api/v1', routes);

// 根路由
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      app: 'Flatmate Manager API',
      version: '1.0.0',
      endpoints: {
        health: '/api/v1/health',
        info: '/api/v1/info',
        flatmates: '/api/v1/flatmates',
        bills: '/api/v1/bills',
        payments: '/api/v1/payments',
        chores: '/api/v1/chores',
        disputes: '/api/v1/disputes',
        notifications: '/api/v1/notifications',
        export: '/api/v1/export',
      },
      documentation: '请查看 README.md 获取完整的 API 文档',
    },
  });
});

// 404 处理
app.use(notFoundHandler);

// 错误处理中间件
app.use(errorHandler);

// 端口配置
const PORT = process.env.PORT || 3000;

// 数据库同步和服务器启动
async function startServer() {
  try {
    // 确保 data 目录存在
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 数据库同步
    console.log('正在同步数据库...');
    await sequelize.sync({ 
      alter: true,  // 开发环境使用 alter，生产环境应使用 migrations
      force: false 
    });
    console.log('数据库同步成功');
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  Flatmate Manager API 已启动`);
      console.log(`========================================`);
      console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  端口: ${PORT}`);
      console.log(`  地址: http://localhost:${PORT}`);
      console.log(`  API: http://localhost:${PORT}/api/v1`);
      console.log(`  健康检查: http://localhost:${PORT}/api/v1/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
if (require.main === module) {
  startServer();
}

module.exports = app;
