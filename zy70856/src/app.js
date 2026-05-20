require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path,
    method: req.method
  });
});

const startServer = async () => {
  try {
    await connectDB();
    console.log('数据库连接成功');
    
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      档案室管理系统后端服务启动成功                        ║
║                                                           ║
║      服务地址: http://localhost:${PORT}                      ║
║      API前缀:  http://localhost:${PORT}/api                  ║
║      健康检查: http://localhost:${PORT}/api/health           ║
║                                                           ║
║      环境: ${process.env.NODE_ENV || 'development'}         ║
║      启动时间: ${new Date().toLocaleString('zh-CN')}         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

startServer();

module.exports = app;
