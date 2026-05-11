const express = require('express');
const fs = require('fs');
const path = require('path');
const { initDatabase, seedData } = require('./database');
const applicationsRouter = require('./routes/applications');
const schedulerService = require('./services/schedulerService');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function startServer() {
  await initDatabase();
  seedData();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/applications', applicationsRouter);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
  });

  app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  schedulerService.initScheduler();

  app.listen(PORT, () => {
    console.log(`售后配件寄送API服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log('');
    console.log('API接口:');
    console.log('  POST   /api/applications              - 创建配件申请');
    console.log('  GET    /api/applications              - 查询申请列表');
    console.log('  GET    /api/applications/pending-shipments   - 待发货查询');
    console.log('  GET    /api/applications/pending-recycling   - 待回收查询');
    console.log('  GET    /api/applications/consumption         - 配件消耗统计');
    console.log('  GET    /api/applications/abnormal            - 异常申请查询');
    console.log('  GET    /api/applications/todos               - 逾期待办');
    console.log('  GET    /api/applications/inventory           - 库存状态');
    console.log('  GET    /api/applications/warranty/:sn        - 保修信息查询');
    console.log('  GET    /api/applications/:no                 - 申请详情');
    console.log('  POST   /api/applications/:no/review          - 审核申请');
    console.log('  POST   /api/applications/:no/lock-inventory  - 锁定库存');
    console.log('  POST   /api/applications/:no/ship            - 发货');
    console.log('  POST   /api/applications/:no/deliver         - 签收');
    console.log('  POST   /api/applications/:no/receive-old-part - 回收旧件');
    console.log('  POST   /api/applications/:no/close           - 关闭申请');
    console.log('  POST   /api/applications/:no/modify-address  - 修改收货地址');
    console.log('');
  });
}

startServer().catch(err => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});
