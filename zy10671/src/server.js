const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const schedulesRouter = require('./routes/schedules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '内容分发排期系统 API 运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/schedules', schedulesRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n🚀 内容分发排期系统 API 已启动`);
      console.log(`📡 服务地址: http://localhost:${PORT}`);
      console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`\n📚 API 文档:`);
      console.log(`  GET  /api/schedules          - 排期列表`);
      console.log(`  GET  /api/schedules/export   - 导出CSV`);
      console.log(`  GET  /api/schedules/channels - 频道列表`);
      console.log(`  GET  /api/schedules/topics   - 专题列表`);
      console.log(`  GET  /api/schedules/:id      - 排期详情`);
      console.log(`  GET  /api/schedules/:id/history - 变更历史`);
      console.log(`  POST /api/schedules          - 创建排期`);
      console.log(`  POST /api/schedules/import   - 批量导入`);
      console.log(`  PUT  /api/schedules/:id      - 更新排期`);
      console.log(`  PATCH /api/schedules/:id/status - 变更状态`);
      console.log(`\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();
