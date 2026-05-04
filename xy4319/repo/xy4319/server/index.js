const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initializeDatabase } = require('./database');
const { initWebSocket } = require('./websocket');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// 确保数据目录存在
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 中间件
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API 路由
app.use('/api', routes);

// 静态文件服务（生产环境）
const staticPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'API 接口不存在' });
});

async function startServer() {
  try {
    console.log('========================================');
    console.log('   分诊转运压测台 - 服务器启动中');
    console.log('========================================\n');
    
    // 初始化数据库
    console.log('1. 初始化数据库...');
    await initializeDatabase();
    console.log('   ✓ 数据库初始化完成\n');
    
    // 初始化 WebSocket
    console.log('2. 初始化 WebSocket 服务...');
    initWebSocket(server);
    console.log('   ✓ WebSocket 服务初始化完成\n');
    
    // 启动服务器
    server.listen(PORT, () => {
      console.log('========================================');
      console.log(`   服务器已启动: http://localhost:${PORT}`);
      console.log(`   API 地址: http://localhost:${PORT}/api`);
      console.log(`   WebSocket: ws://localhost:${PORT}`);
      console.log('========================================\n');
      console.log('使用说明:');
      console.log('- 前端开发: cd client && npm run dev (默认端口 5173)');
      console.log('- API 文档: 可通过 HTTP 请求访问 /api 下的接口');
      console.log('- 健康检查: GET /api/health');
      console.log('- 系统信息: GET /api/system/info');
      console.log('- 加载示例数据: POST /api/sample-data');
      console.log('');
    });
    
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

// 未处理的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// 启动服务器
startServer();

module.exports = { app, server };
