const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  console.log('初始化数据库...');
  try {
    execSync('node scripts/init-db.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
  }
}

const riskEventsRouter = require('./routes/riskEvents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '账号冒用风险API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/risk-events', riskEventsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`账号冒用风险API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档:`);
  console.log(`  - POST /api/risk-events - 创建风险事件`);
  console.log(`  - GET /api/risk-events - 查询风险事件列表`);
  console.log(`  - GET /api/risk-events/:id - 查询单个事件详情`);
  console.log(`  - POST /api/risk-events/:id/transition - 状态流转`);
  console.log(`  - POST /api/risk-events/:id/disposition - 执行处置动作`);
  console.log(`  - POST /api/risk-events/:id/review - 提交复核结论`);
  console.log(`  - POST /api/risk-events/:id/manual-correct - 人工修正`);
  console.log(`  - POST /api/risk-events/:id/exception - 异常处理`);
  console.log(`  - GET /api/risk-events/export/csv - 导出CSV`);
  console.log(`========================================\n`);
});
