const express = require('express');
const config = require('./config');
const database = require('./database');
const { getIdempotencyMiddleware } = require('./middleware/idempotency');

const contractRoutes = require('./routes/contracts');
const sealApplicationRoutes = require('./routes/sealApplications');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/health', (req, res) => {
  res.json({
    success: true,
    message: '用章申请风险 API 运行中',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/contracts', contractRoutes);
app.use('/api/seal-applications', sealApplicationRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    code: 500,
    message: '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? err.message : null,
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 404,
    message: '接口不存在',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  await database.initDb();
  
  app.listen(config.port, () => {
    console.log(`\n========================================`);
    console.log(`用章申请风险 API 已启动`);
    console.log(`========================================`);
    console.log(`服务地址: http://localhost:${config.port}`);
    console.log(`健康检查: http://localhost:${config.port}/health`);
    console.log(`\n主要接口:`);
    console.log(`  POST /api/seal-applications           - 创建用章申请`);
    console.log(`  POST /api/seal-applications/:id/submit - 提交审批`);
    console.log(`  POST /api/seal-applications/:id/approve - 审批通过`);
    console.log(`  POST /api/seal-applications/:id/reject  - 审批驳回`);
    console.log(`  POST /api/seal-applications/:id/withdraw - 撤回申请`);
    console.log(`  POST /api/seal-applications/:id/resubmit - 重提申请`);
    console.log(`  POST /api/seal-applications/:id/seal   - 用章确认`);
    console.log(`  GET  /api/seal-applications/:id        - 查询申请详情`);
    console.log(`  GET  /api/seal-applications/:id/timeline - 查询时间线`);
    console.log(`  GET  /api/seal-applications/:id/risks  - 查询风险记录`);
    console.log(`  GET  /api/seal-applications/:id/report - 导出报告`);
    console.log(`  GET  /api/seal-applications/:id/report/text - 导出文本报告`);
    console.log(`\n========================================\n`);
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
