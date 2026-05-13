const express = require('express');
const net = require('net');
const { initSampleData } = require('./models/database');
const { errorHandler } = require('./services/errors');

const sceneRoutes = require('./routes/sceneRoutes');
const presetRoutes = require('./routes/presetRoutes');
const approvalRoutes = require('./routes/approvalRoutes');

const app = express();
const HOST = '127.0.0.1';

const findAvailablePort = (startPort, callback) => {
  const server = net.createServer();
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      server.close();
      findAvailablePort(startPort + 1, callback);
    } else {
      callback(err, null);
    }
  });
  server.once('listening', () => {
    const port = server.address().port;
    server.close();
    callback(null, port);
  });
  server.listen(startPort, HOST);
};

app.use(express.json());

initSampleData();

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '舞台灯光预设回滚 API 服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: '舞台灯光预设回滚 API',
    description: '用于剧场彩排灯光预设版本管理、场景锁定和变更审批',
    endpoints: {
      scenes: '/api/scenes',
      presets: '/api/presets',
      approvals: '/api/approvals',
      health: '/health'
    }
  });
});

app.use('/api/scenes', sceneRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/approvals', approvalRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: '请求的接口不存在',
      timestamp: new Date().toISOString()
    }
  });
});

const startServer = (port) => {
  const server = app.listen(port, HOST, () => {
    const actualPort = server.address().port;
    console.log(`\n========================================`);
    console.log(`  舞台灯光预设回滚 API 已启动`);
    console.log(`  监听地址: ${HOST}:${actualPort}`);
    console.log(`  服务地址: http://${HOST}:${actualPort}`);
    console.log(`  健康检查: http://${HOST}:${actualPort}/health`);
    console.log(`========================================\n`);
    console.log(`示例场景已创建：`);
    console.log(`  - 场景ID: scene-001`);
    console.log(`  - 场景名: 《天鹅湖》第二幕 - 月夜湖畔`);
    console.log(`  - 预设版本: v1.0.0 (已批准)、v2.0.0 (草稿)\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`端口 ${port} 已被占用，尝试下一个端口...`);
      findAvailablePort(port + 1, (findErr, newPort) => {
        if (findErr) {
          console.error('无法找到可用端口:', findErr.message);
          process.exit(1);
        }
        startServer(newPort);
      });
    } else if (err.code === 'EPERM') {
      console.error(`权限错误: 无法绑定到端口 ${port}，正在尝试更高端口...`);
      findAvailablePort(8080, (findErr, newPort) => {
        if (findErr) {
          console.error('无法找到可用端口:', findErr.message);
          process.exit(1);
        }
        startServer(newPort);
      });
    } else {
      console.error('服务器启动失败:', err.message);
      process.exit(1);
    }
  });
};

const START_PORT = parseInt(process.env.PORT) || 3001;
findAvailablePort(START_PORT, (err, port) => {
  if (err) {
    console.error('端口检测失败:', err.message);
    process.exit(1);
  }
  startServer(port);
});
