const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { sequelize } = require('./models');
const shortagesRoutes = require('./routes/shortages');
const JobService = require('./services/JobService');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '供应链缺料承诺API服务已启动',
    version: '1.0.0',
    endpoints: {
      '创建缺料单': 'POST /api/shortages',
      '查询缺料单列表': 'GET /api/shortages',
      '查询缺料单详情': 'GET /api/shortages/:id',
      '更新缺料单': 'PUT /api/shortages/:id',
      '撤回缺料单': 'POST /api/shortages/:id/withdraw',
      '补录缺料单': 'POST /api/shortages/:id/supplement',
      '添加承诺': 'POST /api/shortages/:id/commitments',
      '添加影响订单': 'POST /api/shortages/:id/orders',
      '创建催办任务': 'POST /api/shortages/:id/urges',
      '完成催办任务': 'POST /api/shortages/urges/:taskId/complete',
      '添加到料回执': 'POST /api/shortages/:id/receipts',
      '创建风险报告': 'POST /api/shortages/:id/risks',
      '更新风险报告': 'PUT /api/shortages/risks/:reportId',
      '计算结果': 'GET /api/shortages/:id/result',
      '查询历史记录': 'GET /api/shortages/:id/history',
      '创建后台任务': 'POST /api/shortages/jobs',
      '执行后台任务': 'POST /api/shortages/jobs/:jobId/execute',
      '查询任务状态': 'GET /api/shortages/jobs/:jobId/status',
      '查询任务列表': 'GET /api/shortages/jobs'
    }
  });
});

app.use('/api/shortages', shortagesRoutes);

app.use((err, req, res, next) => {
  console.error('全局错误处理器:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    await sequelize.sync({ alter: true });
    console.log('数据库同步完成');

    cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('开始执行定时任务：处理待执行的后台任务');
        const result = await JobService.processPendingJobs();
        console.log(`定时任务完成：处理了 ${result.totalProcessed} 个任务`);
      } catch (error) {
        console.error('定时任务执行失败:', error);
      }
    });
    console.log('定时任务已启动：每10分钟处理一次待执行任务');

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  供应链缺料承诺API服务已启动`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`========================================\n`);
      console.log(`提示：`);
      console.log(`  1. 访问 http://localhost:${PORT} 查看所有可用接口`);
      console.log(`  2. 可以使用 curl 或 Postman 测试接口`);
      console.log(`  3. 数据库文件位于 data/database.sqlite`);
      console.log(`\n`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();
