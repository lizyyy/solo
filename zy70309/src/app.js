const express = require('express');
const connectDB = require('./config/database');
const orderRoutes = require('./routes/orderRoutes');
const errorHandler = require('./utils/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

connectDB();

app.use('/api/orders', orderRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`订单事件溯源 API 服务运行在端口 ${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/orders`);
});
