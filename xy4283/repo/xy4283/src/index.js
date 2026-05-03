const express = require('express');
const path = require('path');
const database = require('./models/database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 初始化数据库
database.init().then(() => {
  console.log('数据库初始化成功');
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

// 路由配置
app.use('/api', routes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('API错误:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '内部服务器错误',
    details: err.details || null
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '资源不存在'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`灭火器批次召回闭环台服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/api/health`);
});

module.exports = app;
