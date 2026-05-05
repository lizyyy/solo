const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 前端文件
app.use(express.static(path.join(__dirname, 'frontend')));

// 导入路由
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// 根路径路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误', 
    error: err.message 
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});

// 导出app供测试使用
module.exports = app;
