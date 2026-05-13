const express = require('express');
const { initSampleData } = require('./models/database');
const { errorHandler } = require('./services/errors');

const sceneRoutes = require('./routes/sceneRoutes');
const presetRoutes = require('./routes/presetRoutes');
const approvalRoutes = require('./routes/approvalRoutes');

const app = express();
const HOST = '127.0.0.1';

const PORT_RANGES = [
  { start: 10000, end: 10100, name: '用户端口范围 (10000-10100)' },
  { start: 8080, end: 8180, name: '常用端口范围 (8080-8180)' },
  { start: 8888, end: 8988, name: '备用端口范围 (8888-8988)' },
  { start: 3000, end: 3100, name: '开发端口范围 (3000-3100)' }
];

let currentRangeIndex = 0;
let currentPort = 0;

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

const getNextPort = () => {
  if (currentRangeIndex >= PORT_RANGES.length) {
    return null;
  }
  
  const range = PORT_RANGES[currentRangeIndex];
  
  if (currentPort === 0) {
    currentPort = range.start;
  } else {
    currentPort++;
  }
  
  if (currentPort > range.end) {
    currentRangeIndex++;
    currentPort = 0;
    return getNextPort();
  }
  
  return currentPort;
};

const tryStartServer = () => {
  const port = getNextPort();
  
  if (!port) {
    console.error('\n❌ 错误：无法找到可用端口');
    console.error('请检查系统防火墙或端口限制设置');
    process.exit(1);
  }
  
  const range = PORT_RANGES[currentRangeIndex];
  
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
    console.log(`💡 提示：在其他终端使用此端口测试：`);
    console.log(`   export API_PORT=${actualPort}`);
    console.log(`   curl http://${HOST}:${actualPort}/health\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`端口 ${port} 已被占用，尝试下一个...`);
      tryStartServer();
    } else if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.log(`端口 ${port} 权限不足，尝试 ${range.name} 的其他端口...`);
      tryStartServer();
    } else {
      console.error(`端口 ${port} 启动失败 (${err.code})，尝试下一个...`);
      tryStartServer();
    }
  });
};

console.log('🚀 正在启动舞台灯光预设回滚 API...');
console.log('🔍 正在寻找可用端口...');

const envPort = parseInt(process.env.PORT);
if (envPort) {
  console.log(`📌 尝试使用环境变量指定的端口: ${envPort}`);
  currentRangeIndex = -1;
  currentPort = envPort - 1;
}

tryStartServer();
