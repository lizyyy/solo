const express = require('express');
const { initDatabase } = require('./database');
const app = express();
const PORT = process.env.PORT || 3000;

const batchesRouter = require('./routes/batches');
const scoresRouter = require('./routes/scores');
const reportsRouter = require('./routes/reports');

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '宿舍维修评分API服务运行正常' });
});

app.use('/api/batches', batchesRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/reports', reportsRouter);

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   校园宿舍维修评分 API 服务                               ║
║   运行端口: ${PORT}                                        ║
║   健康检查: http://localhost:${PORT}/health                 ║
║                                                          ║
║   API 端点:                                               ║
║   POST   /api/batches              - 创建批次            ║
║   GET    /api/batches              - 获取所有批次        ║
║   GET    /api/batches/:id          - 获取批次详情        ║
║   PATCH  /api/batches/:id/status   - 更新批次状态        ║
║   POST   /api/scores/:id/appeal    - 提交申诉            ║
║   POST   /api/scores/:id/review    - 后勤复核            ║
║   GET    /api/reports/batches/:id  - 获取报告            ║
║   GET    /api/reports/batches/:id/download - 下载CSV     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
