const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const discountFreezeRoutes = require('./routes/discountFreezeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '自助洗车场优惠冻结API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/discount-freeze', discountFreezeRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    errorMessage: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    errorMessage: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
=========================================
自助洗车场优惠冻结API服务已启动
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health
API文档:
  POST /api/discount-freeze          - 创建优惠冻结申请
  GET  /api/discount-freeze          - 获取优惠冻结列表
  GET  /api/discount-freeze/exceptions - 获取异常列表
  GET  /api/discount-freeze/stats    - 获取统计数据
  PUT  /api/discount-freeze/:freezeId/audit - 审核优惠冻结
  PUT  /api/discount-freeze/exceptions/:exceptionId/handle - 处理异常
=========================================
  `);
});
