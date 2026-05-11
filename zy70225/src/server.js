const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { seedData } = require('../data/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  水产苗种分池 API 服务器已启动`);
  console.log(`========================================`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 基础路径: http://localhost:${PORT}/api`);
  console.log(`========================================`);
  console.log(`\n可用接口:`);
  console.log(`  GET  /api/health                - 健康检查`);
  console.log(`  GET  /api/ponds                 - 获取所有池塘`);
  console.log(`  GET  /api/batches               - 获取所有批次`);
  console.log(`  POST /api/batches               - 创建苗种批次`);
  console.log(`  GET  /api/batches/:id           - 获取批次详情`);
  console.log(`  POST /api/batches/:id/prepare-transfer - 准备分池`);
  console.log(`  POST /api/transfers             - 执行分池`);
  console.log(`  POST /api/transfers/:id/correct - 人工修正分池`);
  console.log(`  POST /api/batches/:id/reports   - 生成养殖报表`);
  console.log(`\n========================================`);
  
  seedData();
  console.log(`\n样例数据已加载，可开始测试!`);
});