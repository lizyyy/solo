const express = require('express');
const cors = require('cors');
const path = require('path');

const batchRoutes = require('./routes/batches');
const importRoutes = require('./routes/import');
const orderRoutes = require('./routes/orders');
const queryRoutes = require('./routes/query');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '护理站后端服务运行正常',
    timestamp: new Date().toISOString(),
    data: {
      service: 'nursing-station-service',
      version: '1.0.0',
      features: [
        '批次管理',
        '服务单导入',
        '护士日历管理',
        '老人档案管理',
        '追踪记录',
        '状态流转',
        '历史查询',
        '数据导出',
        '路线溯源'
      ]
    }
  });
});

app.use('/api/batches', batchRoutes);
app.use('/api/import', importRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/query', queryRoutes);

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.path });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     护理站后端服务 - 可追踪记录管理系统 v1.0.0              ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                          ║
║  健康检查: http://localhost:${PORT}/api/health               ║
╠════════════════════════════════════════════════════════════╣
║  API 接口:                                                  ║
║    POST   /api/batches              - 新增批次               ║
║    GET    /api/batches              - 批次列表               ║
║    POST   /api/import/service-orders - 导入服务单CSV        ║
║    POST   /api/import/nurse-calendar - 导入护士日历JSON     ║
║    GET    /api/orders               - 服务单列表             ║
║    PUT    /api/orders/:id/process   - 标记处理               ║
║    PUT    /api/orders/:id/approve   - 审核通过               ║
║    PUT    /api/orders/:id/return    - 退回修改               ║
║    PUT    /api/orders/:id/cancel    - 取消                   ║
║    PUT    /api/orders/:id/replace   - 取消补位               ║
║    GET    /api/query/track-records  - 追踪记录查询           ║
║    GET    /api/query/route-trace    - 上门路线溯源           ║
║    POST   /api/query/export         - 导出明细               ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
