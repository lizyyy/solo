const express = require('express');
const bodyParser = require('body-parser');
const compensationRoutes = require('./routes/compensationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/compensations', compensationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '露营装备店帐篷租赁赔付 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    message: `请求的路径 ${req.path} 不存在`
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  POST   /api/compensations          - 创建赔付记录');
  console.log('  GET    /api/compensations/:no      - 查询单条赔付记录');
  console.log('  GET    /api/compensations           - 查询赔付记录列表');
  console.log('  PUT    /api/compensations/:no      - 更新赔付记录');
  console.log('  GET    /api/compensations/export/csv - 导出CSV');
  console.log('  POST   /api/compensations/import/csv - 导入CSV');
  console.log('  GET    /health                       - 健康检查');
});
