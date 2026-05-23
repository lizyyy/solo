const express = require('express');
const bodyParser = require('body-parser');
const rentalRoutes = require('./routes/rentalRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', rentalRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '租赁设备押金API' });
});

app.listen(PORT, () => {
  console.log(`租赁设备押金API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档:`);
  console.log(`  POST /api/equipment - 添加设备`);
  console.log(`  GET  /api/equipment - 获取设备列表`);
  console.log(`  POST /api/rentals - 创建租赁单`);
  console.log(`  GET  /api/rentals - 获取租赁单列表`);
  console.log(`  GET  /api/rentals/:id - 获取租赁单详情`);
  console.log(`  POST /api/rentals/:id/freeze-deposit - 押金冻结`);
  console.log(`  POST /api/rentals/:id/renew - 续租`);
  console.log(`  POST /api/rentals/:id/damage - 报损坏`);
  console.log(`  POST /api/rentals/:id/settle - 结算`);
  console.log(`  POST /api/rentals/:id/manual-correction - 人工修正`);
  console.log(`  GET  /api/settlements - 获取结算列表`);
  console.log(`  GET  /api/settlements/export - 导出结算CSV`);
  console.log(`  GET  /api/exceptions - 获取异常日志`);
});

module.exports = app;
