const express = require('express');
const { initDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Operator, X-Gate');
  next();
});

app.use('/api/verification', require('./routes/verification'));
app.use('/api/visitors', require('./routes/visitors'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '园区安保系统运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 文档:');
      console.log('  GET  /api/health - 健康检查');
      console.log('  POST /api/verification/visitor - 访客核验');
      console.log('  POST /api/verification/plate - 车牌核验');
      console.log('  POST /api/verification/manual-release - 人工放行');
      console.log('  GET  /api/verification/records - 查询核验记录');
      console.log('  GET  /api/verification/statistics - 统计数据');
      console.log('  POST /api/verification/batch/visitors - 批量核验访客');
      console.log('  GET  /api/verification/report/export - 导出报告');
      console.log('  POST /api/visitors - 创建访客预约');
      console.log('  GET  /api/visitors - 查询访客列表');
      console.log('  POST /api/visitors/:id/approve - 审批通过');
      console.log('  POST /api/visitors/:id/reject - 审批拒绝');
      console.log('  POST /api/visitors/plates - 创建临时车牌');
      console.log('  POST /api/visitors/blacklist - 添加黑名单');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
