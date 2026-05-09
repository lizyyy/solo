const express = require('express');
const path = require('path');
const { initDb } = require('./src/database');
const { registerRoutes } = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json({ limit: '10mb' }));

const dbPath = path.join(__dirname, 'data', 'complaints.db');
const db = initDb(dbPath);

registerRoutes(app, db);

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`民宿噪音投诉证据API已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`数据库: ${dbPath}`);
  console.log(`========================================`);
  console.log('');
  console.log('可用API端点:');
  console.log('  GET  /api/health                    - 健康检查');
  console.log('  POST /api/orders                    - 创建订单');
  console.log('  GET  /api/orders/:id                - 查询订单');
  console.log('  POST /api/decibel-records           - 上传分贝记录');
  console.log('  GET  /api/decibel-records/:id       - 查询分贝记录');
  console.log('  POST /api/complaints                - 创建投诉单');
  console.log('  GET  /api/complaints/:id            - 查询投诉单详情');
  console.log('  POST /api/complaints/:id/advance    - 推进投诉单状态');
  console.log('  POST /api/complaints/:id/withdraw   - 撤回投诉单');
  console.log('  POST /api/complaints/:id/amend      - 修正投诉单');
  console.log('  POST /api/evidence-segments         - 上传证据片段');
  console.log('  GET  /api/evidence-segments/:id     - 查询证据片段');
  console.log('  GET  /api/rules                     - 查询赔付规则');
  console.log('  POST /api/rules                     - 创建/更新赔付规则');
  console.log('  GET  /api/complaints                - 投诉单列表/汇总查询');
  console.log('  GET  /api/export/complaints         - 导出投诉数据CSV');
  console.log('  GET  /api/process-history/:complaintId - 查询处理历史');
  console.log('');
  console.log('示例脚本:');
  console.log('  npm run seed:success  - 执行顺利流程样例');
  console.log('  npm run seed:intercept - 执行拦截/待复核样例');
});
