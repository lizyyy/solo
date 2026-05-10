const express = require('express');
const { initSampleData } = require('./models/database');
const { errorHandler } = require('./services/errors');

const sceneRoutes = require('./routes/sceneRoutes');
const presetRoutes = require('./routes/presetRoutes');
const approvalRoutes = require('./routes/approvalRoutes');

const app = express();
const PORT = 3001;

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

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  舞台灯光预设回滚 API 已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
  console.log(`示例场景已创建：`);
  console.log(`  - 场景ID: scene-001`);
  console.log(`  - 场景名: 《天鹅湖》第二幕 - 月夜湖畔`);
  console.log(`  - 预设版本: v1.0.0 (已批准)、v2.0.0 (草稿)\n`);
});
