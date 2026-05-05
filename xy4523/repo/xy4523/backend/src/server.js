const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', apiRoutes);

app.get('/api/info', (req, res) => {
  res.json({
    name: '温室授粉管理系统',
    version: '1.0.0',
    description: '植物园温室授粉管理本地工具',
    endpoints: {
      import: {
        sensor: 'POST /api/import/sensor - 上传温湿度CSV',
        pollination: 'POST /api/import/pollination-plans - 上传授粉计划JSON',
        isolation: 'POST /api/import/isolation - 上传隔离棚计划JSON',
        batches: 'POST /api/import/plant-batches - 上传苗床批次JSON',
        shifts: 'POST /api/import/employee-shifts - 上传员工班次JSON'
      },
      assessment: {
        run: 'POST /api/assessment/run - 运行每日评估',
        get: 'GET /api/assessment?date=YYYY-MM-DD - 获取评估结果',
        update: 'PUT /api/assessment/:plant_batch_id - 人工改判'
      },
      export: {
        markdown: 'GET /api/export/markdown?date=YYYY-MM-DD - 导出Markdown工作单',
        json: 'GET /api/export/json?date=YYYY-MM-DD - 导出JSON审计明细'
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    success: false
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalPath
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🌿 温室授粉管理系统后端已启动');
  console.log('========================================');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API地址:  http://localhost:${PORT}/api`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`接口信息: http://localhost:${PORT}/api/info`);
  console.log('========================================');
});

module.exports = app;
