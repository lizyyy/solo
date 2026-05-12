const express = require('express');
const cors = require('cors');
const path = require('path');

const ordersRouter = require('./routes/orders');
const customersRouter = require('./routes/customers');
const commonRouter = require('./routes/common');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/orders', ordersRouter);
app.use('/api/customers', customersRouter);
app.use('/api', commonRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '桶装冰块配送台服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API 文档:');
  console.log('  GET  /api/health - 健康检查');
  console.log('  GET  /api/orders - 订单列表');
  console.log('  POST /api/orders - 创建订单');
  console.log('  GET  /api/customers - 客户列表');
  console.log('  GET  /api/ice-specs - 冰块规格');
  console.log('  GET  /api/delivery-slots - 配送时段');
  console.log('  GET  /api/coolers - 保温箱列表');
  console.log('  GET  /api/capacity-alerts - 产能预警');
});
