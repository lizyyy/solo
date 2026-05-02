const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('./storage/database');
const routes = require('./routes');
const config = require('./config');

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 简单的角色模拟中间件
app.use((req, res, next) => {
  const role = req.headers['x-user-role'] || 'user';
  const userId = req.headers['x-user-id'] || uuidv4();
  req.user = {
    id: userId,
    role: role
  };
  next();
});

// 路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: moment().toISOString(),
    service: '危化品领用追溯站'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || '服务器内部错误',
      code: err.code || 'INTERNAL_ERROR'
    }
  });
});

// 启动服务器
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`危化品领用追溯站服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/docs`);
  
  // 初始化数据库
  db.init();
});

module.exports = app;
