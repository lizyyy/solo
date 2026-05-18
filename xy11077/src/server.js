const express = require('express');
const bodyParser = require('body-parser');
const { errorHandler } = require('./middleware/errorHandler');

const repairRecordsRoutes = require('./routes/repairRecords');
const repairTeamsRoutes = require('./routes/repairTeams');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: '校园宿舍维修队宿舍维修合并API运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/v1/repair-records', repairRecordsRoutes);
app.use('/api/v1/repair-teams', repairTeamsRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    errorCode: 'ENDPOINT_NOT_FOUND',
    message: '请求的API端点不存在',
    path: req.originalUrl,
    availableEndpoints: {
      records: '/api/v1/repair-records',
      teams: '/api/v1/repair-teams',
      health: '/health'
    }
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   校园宿舍维修队宿舍维修合并 API                           ║
║                                                           ║
║   服务已启动: http://localhost:${PORT}                       ║
║                                                           ║
║   API文档:                                                ║
║   - 健康检查:    GET  /health                             ║
║   - 维修记录:    GET  /api/v1/repair-records              ║
║                 POST /api/v1/repair-records              ║
║   - 合并记录:    POST /api/v1/repair-records/merge       ║
║   - 复核记录:    POST /api/v1/repair-records/:id/review  ║
║   - 导入记录:    POST /api/v1/repair-records/import      ║
║   - 导出CSV:     GET  /api/v1/repair-records/export/csv  ║
║   - 周报统计:    GET  /api/v1/repair-records/report/weekly ║
║   - 维修队伍:    GET  /api/v1/repair-teams                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
