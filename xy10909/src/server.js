const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const reportsDir = path.join(dataDir, 'reports');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('创建数据目录:', dataDir);
}
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  console.log('创建报告目录:', reportsDir);
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`工地人员进出API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`=================================`);
  console.log('API接口列表:');
  console.log('  POST /api/gate-events          - 上报闸机事件');
  console.log('  GET  /api/gate-events/:id/trace - 查询闸机事件追溯链');
  console.log('  POST /api/personnel            - 新增人员档案');
  console.log('  POST /api/personnel/:id/training - 新增培训记录');
  console.log('  POST /api/personnel/:id/blacklist - 加入黑名单');
  console.log('  POST /api/visitors             - 新增访客申请');
  console.log('  PUT  /api/visitors/:id/status  - 更新访客状态');
  console.log('  GET  /api/exceptions/:id/trace - 查询异常记录追溯链');
  console.log('  POST /api/reports/daily        - 生成日常通行报告');
  console.log('  POST /api/corrections          - 人工数据修正');
  console.log(`=================================`);
});
