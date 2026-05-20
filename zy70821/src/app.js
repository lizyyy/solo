const express = require('express');
const bodyParser = require('body-parser');
const appointmentRoutes = require('./routes/appointments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/appointments', appointmentRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '疫苗预约管理API'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    code: err.code || 'UNKNOWN_ERROR'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在',
    code: 'NOT_FOUND',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           社区卫生服务站 - 疫苗预约管理API                     ║
╠══════════════════════════════════════════════════════════════╣
║  服务已启动，监听端口: ${PORT}                                  ║
║  健康检查: http://localhost:${PORT}/health                      ║
╠══════════════════════════════════════════════════════════════╣
║  API 端点:                                                     ║
║  POST /api/appointments/upload    - 上传并处理预约文件         ║
║  GET  /api/appointments/batch/:id - 获取批次处理结果           ║
║  GET  /api/appointments/inventory  - 查询疫苗库存              ║
║  PUT  /api/appointments/inventory  - 更新疫苗库存              ║
║  GET  /api/appointments/rules      - 查询禁忌规则              ║
║  PUT  /api/appointments/rules      - 更新禁忌规则              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
