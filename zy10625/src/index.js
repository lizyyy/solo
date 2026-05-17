const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3088;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '合同归档服务电子签章重签登记API', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`合同归档服务电子签章重签登记API已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
  console.log(`API端点列表:`);
  console.log(`  POST /api/contracts          - 创建合同`);
  console.log(`  POST /api/signatories        - 创建签署方`);
  console.log(`  POST /api/records            - 创建重签记录`);
  console.log(`  PUT  /api/records/:id/modify - 修改重签记录`);
  console.log(`  PUT  /api/records/:id/audit  - 审核重签记录`);
  console.log(`  PUT  /api/records/:id/withdraw - 撤回重签记录`);
  console.log(`  GET  /api/records            - 列表查询`);
  console.log(`  GET  /api/records/:id         - 详情查询`);
  console.log(`  GET  /api/records/:id/history - 历史记录`);
  console.log(`  POST /api/records/:id/check-version - 版本冲突检测`);
  console.log(`  GET  /api/pending-manual     - 待人工处理列表`);
  console.log(`  POST /api/import             - 批量导入`);
  console.log(`  GET  /api/export             - 导出数据 (CSV/JSON)`);
  console.log(`  GET  /api/export/history/:id - 导出历史记录`);
  console.log(`\n`);
});
