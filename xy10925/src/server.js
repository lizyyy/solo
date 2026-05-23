const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const groupsRouter = require('./routes/groups');
const athletesRouter = require('./routes/athletes');
const checkinRouter = require('./routes/checkin');
const substitutesRouter = require('./routes/substitutes');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/groups', groupsRouter);
app.use('/api/athletes', athletesRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/substitutes', substitutesRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`赛事检录资格 API 服务运行在 http://localhost:${PORT}`);
  console.log('');
  console.log('API 端点:');
  console.log('  GET  /api/health              - 健康检查');
  console.log('');
  console.log('  POST /api/groups              - 创建组别');
  console.log('  GET  /api/groups              - 获取所有组别');
  console.log('');
  console.log('  POST /api/athletes            - 创建选手');
  console.log('  GET  /api/athletes            - 获取所有选手');
  console.log('  GET  /api/athletes/:id        - 获取选手详情');
  console.log('  POST /api/athletes/:id/documents - 上传/更新证件');
  console.log('');
  console.log('  POST /api/checkin             - 执行检录');
  console.log('  GET  /api/checkin             - 获取所有检录记录');
  console.log('  POST /api/checkin/manual      - 人工修正');
  console.log('  GET  /api/checkin/status-history/:athleteId - 获取状态历史');
  console.log('');
  console.log('  POST /api/substitutes         - 添加替补');
  console.log('  POST /api/substitutes/promote/:groupId - 替补递补');
  console.log('');
  console.log('  POST /api/reports/:athleteId  - 生成资格报告');
  console.log('  GET  /api/reports/export/csv  - 导出 CSV 报告');
  console.log('');
});

module.exports = app;
