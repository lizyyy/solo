const express = require('express');
const config = require('./config');
const { getDb } = require('./db');

const showsRouter = require('./routes/shows');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  try {
    getDb();
    res.json({
      success: true,
      message: '票务限购 API 运行正常',
      version: '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务异常',
      error: error.message
    });
  }
});

app.use('/api/shows', showsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在，请检查 URL',
    hint: '可用接口: /api/shows, /api/orders, /api/admin/dashboard'
  });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    success: false,
    message: '服务内部错误',
    error: err.message
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`\n========================================`);
    console.log(`  演出票务限购 API 已启动`);
    console.log(`  服务地址: http://localhost:${config.port}`);
    console.log(`  健康检查: http://localhost:${config.port}/health`);
    console.log(`========================================\n`);
    console.log(`默认限购规则:`);
    console.log(`  - 单证件每场限购: ${config.limit.perIdCard} 张`);
    console.log(`  - 单账号每场限购: ${config.limit.perAccount} 张`);
    console.log(`  - 单支付渠道每场限购: ${config.limit.perPayment} 张`);
    console.log(`\n快速开始:`);
    console.log(`  1. 创建演出: POST /api/shows`);
    console.log(`  2. 添加票档: POST /api/shows/{showId}/tiers`);
    console.log(`  3. 用户购票: POST /api/orders`);
    console.log(`  4. 查看报表: GET /api/admin/dashboard`);
    console.log(`\n运行测试:`);
    console.log(`  npm run test        - Node.js 端到端测试`);
    console.log(`  npm run test:curl   - Shell curl 测试脚本`);
  });
}

module.exports = app;
