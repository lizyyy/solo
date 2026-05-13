const express = require('express');
const { initSampleData } = require('./models/database');
const { errorHandler } = require('./services/errors');

const sceneRoutes = require('./routes/sceneRoutes');
const presetRoutes = require('./routes/presetRoutes');
const approvalRoutes = require('./routes/approvalRoutes');

const app = express();
const HOST = '127.0.0.1';

const PORT_CANDIDATES = [
  49152, 49153, 49154, 49155, 49156,
  50000, 50001, 50002, 50003, 50004,
  55000, 55001, 55002, 55003, 55004,
  58000, 58001, 58002, 58003, 58004,
  60000, 60001, 60002, 60003, 60004,
  65000, 65001, 65002, 65003, 65004,
  10000, 10001, 10002, 10003, 10004,
  8080, 8081, 8082, 8083, 8084,
  8888, 8889, 8890, 8891, 8892,
  3000, 3001, 3002, 3003, 3004
];

let portIndex = 0;

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

const printSuccess = (port) => {
  console.log(`\n========================================`);
  console.log(`  舞台灯光预设回滚 API 已启动`);
  console.log(`  监听地址: ${HOST}:${port}`);
  console.log(`  服务地址: http://${HOST}:${port}`);
  console.log(`  健康检查: http://${HOST}:${port}/health`);
  console.log(`========================================\n`);
  console.log(`示例场景已创建：`);
  console.log(`  - 场景ID: scene-001`);
  console.log(`  - 场景名: 《天鹅湖》第二幕 - 月夜湖畔`);
  console.log(`  - 预设版本: v1.0.0 (已批准)、v2.0.0 (草稿)\n`);
  console.log(`💡 提示：在其他终端使用此端口测试：`);
  console.log(`   export API_PORT=${port}`);
  console.log(`   curl http://${HOST}:${port}/health\n`);
};

const tryPort = (port) => {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST, () => {
      const actualPort = server.address().port;
      resolve({ server, port: actualPort });
    });
    server.on('error', (err) => {
      reject(err);
    });
  });
};

const tryPortZero = async () => {
  console.log('📡 尝试让系统自动分配端口 (port=0)...');
  try {
    const result = await tryPort(0);
    console.log(`✅ 系统自动分配端口成功: ${result.port}`);
    printSuccess(result.port);
    return result.server;
  } catch (err) {
    console.log(`❌ 自动分配端口失败: ${err.message}`);
    return null;
  }
};

const trySpecificPort = async (port) => {
  console.log(`📡 尝试端口: ${port}`);
  try {
    const result = await tryPort(port);
    console.log(`✅ 端口 ${port} 可用`);
    printSuccess(result.port);
    return result.server;
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.log(`⏭️  端口 ${port} 已被占用，尝试下一个...`);
    } else if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.log(`⏭️  端口 ${port} 权限不足，尝试下一个...`);
    } else {
      console.log(`⏭️  端口 ${port} 不可用 (${err.code})，尝试下一个...`);
    }
    return null;
  }
};

const startServer = async () => {
  console.log('🚀 正在启动舞台灯光预设回滚 API...');
  
  const envPort = parseInt(process.env.PORT);
  if (envPort && envPort > 0 && envPort < 65536) {
    console.log(`📌 环境变量指定端口: ${envPort}`);
    const result = await trySpecificPort(envPort);
    if (result) return;
    console.log(`⚠️  指定端口不可用，将尝试其他端口...`);
  }
  
  console.log('🔍 正在寻找可用端口...');
  
  const portZeroResult = await tryPortZero();
  if (portZeroResult) return;
  
  console.log('🔄 尝试常用端口范围...');
  
  for (const port of PORT_CANDIDATES) {
    const result = await trySpecificPort(port);
    if (result) return;
  }
  
  console.error('\n❌ 错误：无法找到可用端口');
  console.error('请检查系统防火墙或端口限制设置');
  process.exit(1);
};

startServer();
