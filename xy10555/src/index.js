const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '二手车检测估价 API 运行中',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/valuations', require('./routes/valuations'));

app.use((err, req, res, next) => {
  console.error('全局错误处理:', err);
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: '数据冲突',
      details: err.errors?.map(e => e.message)
    });
  }
  
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      details: err.errors?.map(e => ({ field: e.path, message: e.message }))
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

async function startServer() {
  try {
    await db.sequelize.authenticate();
    console.log('数据库连接成功');
    
    await db.sequelize.sync();
    console.log('数据库同步完成');
    
    app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log('二手车检测估价 API 已启动');
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log('='.repeat(60));
      console.log('可用接口:');
      console.log('  GET  /health                       - 健康检查');
      console.log('  POST /api/valuations               - 创建估价');
      console.log('  GET  /api/valuations               - 查询估价列表');
      console.log('  GET  /api/valuations/:id           - 查询估价详情');
      console.log('  POST /api/valuations/:id/advance   - 推进状态');
      console.log('  POST /api/valuations/:id/quote-versions  - 创建报价版本');
      console.log('  POST /api/valuations/:id/manual-corrections - 人工修正');
      console.log('  GET  /api/valuations/:id/report    - 生成报告');
      console.log('  GET  /api/valuations/:id/report/export - 导出报告');
      console.log('  POST /api/valuations/:id/handle-error - 异常处理');
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
