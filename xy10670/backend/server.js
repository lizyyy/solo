const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database');
const ordersRouter = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/orders', ordersRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '文印订单设备排队系统运行正常' });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化成功');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 文档:');
      console.log('  GET  /api/health - 健康检查');
      console.log('  GET  /api/orders - 获取订单列表');
      console.log('  GET  /api/orders/constants - 获取常量');
      console.log('  GET  /api/orders/:id - 获取订单详情');
      console.log('  GET  /api/orders/:id/timeline - 获取订单时间线');
      console.log('  POST /api/orders - 创建订单');
      console.log('  POST /api/orders/bulk-import - 批量导入订单');
      console.log('  GET  /api/orders/export/csv - 导出订单CSV');
      console.log('  POST /api/orders/demo/all - 运行所有演示路径');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
