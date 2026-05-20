const express = require('express');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`酒店后勤布草洗涤管理服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 接口列表:');
  console.log('  POST /api/room-types/import  - 导入房型配置');
  console.log('  GET  /api/room-types          - 查询房型标准');
  console.log('  POST /api/batches             - 新增洗涤批次(送洗CSV)');
  console.log('  GET  /api/batches             - 查询洗涤批次列表');
  console.log('  GET  /api/batches/:id         - 查询批次详情');
  console.log('  POST /api/batches/:id/process - 标记处理/退回修改');
  console.log('  POST /api/recovery            - 导入回收单JSON');
  console.log('  POST /api/compensation        - 登记赔付记录');
  console.log('  GET  /api/compensations       - 查询赔付记录');
  console.log('  GET  /api/export/details      - 导出明细数据');
  console.log('  GET  /api/logs                - 查询操作日志');
});

module.exports = app;
