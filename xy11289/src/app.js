const express = require('express');
const cors = require('cors');
const equipmentRoutes = require('./routes/equipment');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: '会展项目设备管理系统 API',
    version: '1.0.0',
    endpoints: {
      borrow: 'POST /api/equipment/borrow - 借用设备',
      return: 'POST /api/equipment/return - 归还设备',
      rollback: 'POST /api/equipment/rollback/:recordId - 回滚操作',
      records: 'GET /api/equipment/records - 查询记录',
      export: 'GET /api/equipment/records/export - 导出CSV',
      equipments: 'GET /api/equipment/equipments - 获取所有设备',
      booths: 'GET /api/equipment/booths - 获取所有展位',
      logs: 'GET /api/equipment/logs - 获取操作日志',
      statistics: 'GET /api/equipment/statistics - 获取统计数据',
      equipment: 'GET /api/equipment/equipment/:barcode - 查询单个设备'
    }
  });
});

app.use('/api/equipment', equipmentRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档访问: http://localhost:3000');
});

module.exports = app;
