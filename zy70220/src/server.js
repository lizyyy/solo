const express = require('express');
const config = require('./config');

const startServer = async () => {
  const db = require('./db');
  await db.initDB();

  const tankRoutes = require('./routes/tank');
  const staysRoutes = require('./routes/stays');
  const usagesRoutes = require('./routes/usages');
  const historyRoutes = require('./routes/history');

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'running',
        tank_max_capacity: config.WATER_TANK_MAX_CAPACITY,
        default_tank_id: config.DEFAULT_WATER_TANK_ID
      }
    });
  });

  app.use('/api/tank', tankRoutes);
  app.use('/api/stays', staysRoutes);
  app.use('/api/usages', usagesRoutes);
  app.use('/api/history', historyRoutes);

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: {
        type: 'InternalServerError',
        message: '服务器内部错误'
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`海岛民宿淡水配额 API 服务已启动`);
    console.log(`监听端口: ${PORT}`);
    console.log(`API 基础地址: http://localhost:${PORT}/api`);
    console.log('');
    console.log('可用端点:');
    console.log('  GET  /api/health                - 健康检查');
    console.log('  GET  /api/tank/status           - 水箱状态');
    console.log('  POST /api/tank/supply           - 水箱补给');
    console.log('  GET  /api/tank/history          - 水箱历史');
    console.log('  GET  /api/stays                 - 活跃入住列表');
    console.log('  POST /api/stays/checkin         - 办理入住');
    console.log('  GET  /api/stays/:id             - 入住详情');
    console.log('  POST /api/stays/:id/checkout    - 办理退房');
    console.log('  PATCH /api/stays/:id            - 更新入住信息');
    console.log('  POST /api/stays/:id/cancel      - 取消入住');
    console.log('  GET  /api/stays/:id/history     - 入住历史');
    console.log('  GET  /api/usages                - 用水记录列表');
    console.log('  POST /api/usages/laundry        - 记录洗衣用水');
    console.log('  POST /api/usages/pool           - 记录泳池补水');
    console.log('  POST /api/usages/other          - 记录其他用水');
    console.log('  GET  /api/usages/:id            - 用水记录详情');
    console.log('  POST /api/usages/:id/revoke     - 撤回到水记录');
    console.log('  POST /api/usages/:id/correct    - 修正用水记录');
    console.log('  GET  /api/usages/:id/history    - 用水记录历史');
    console.log('  GET  /api/history               - 所有操作历史');
  });
};

startServer().catch(err => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});
