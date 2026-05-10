const express = require('express');
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
const ticketsRouter = require('./routes/tickets');
const adminRouter = require('./routes/admin');

app.use('/api/tickets', ticketsRouter);
app.use('/api/admin', adminRouter);

// 根路由
app.get('/', (req, res) => {
  res.json({
    name: '工单 SLA 暂停恢复 API 系统',
    version: '1.0.0',
    description: '管理客户工单的 SLA 暂停和恢复，处理等待用户补充材料等场景',
    endpoints: {
      tickets: '/api/tickets',
      admin: '/api/admin',
      status: '/api/admin/status'
    },
    features: [
      '工单创建和管理',
      'SLA 暂停和恢复',
      '暂停原因跟踪',
      '超时升级机制',
      '客服报表生成',
      '冲突检测和撤销功能'
    ]
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '端点未找到', url: req.url });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  工单 SLA 暂停恢复 API 系统`);
  console.log(`  服务器运行在 http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`API 端点:`);
  console.log(`  - GET  /                     - 系统信息`);
  console.log(`  - POST /api/tickets          - 创建工单`);
  console.log(`  - GET  /api/tickets          - 获取工单列表`);
  console.log(`  - GET  /api/tickets/:id      - 获取工单详情`);
  console.log(`  - POST /api/tickets/:id/pause  - 暂停 SLA`);
  console.log(`  - POST /api/tickets/:id/resume - 恢复 SLA`);
  console.log(`  - POST /api/tickets/:id/cancel-pause - 撤销暂停`);
  console.log(`  - POST /api/tickets/:id/close - 关闭工单`);
  console.log(`  - GET  /api/tickets/:id/pause-history - 获取暂停历史`);
  console.log(`  - GET  /api/admin/reports    - 生成报表`);
  console.log(`  - POST /api/admin/check-escalations - 检查超时升级`);
  console.log(`  - GET  /api/admin/status     - 系统状态`);
  console.log(`\n`);
});

module.exports = app;
