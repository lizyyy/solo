const express = require('express');
const config = require('./config');
const apiRoutes = require('./routes/api');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '会员拼桌排号服务',
    version: '1.0.0',
    description: '餐厅排队管理系统后端服务',
    endpoints: '/api',
    docs: '请访问 /api 查看可用接口'
  });
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    detail: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(config.PORT, () => {
  console.log(`\n========================================`);
  console.log(`  会员拼桌排号服务已启动`);
  console.log(`  服务地址: http://localhost:${config.PORT}`);
  console.log(`  API文档: http://localhost:${config.PORT}/api`);
  console.log(`========================================\n`);
});
