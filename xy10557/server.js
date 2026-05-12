const express = require('express');
const cors = require('cors');
const { initSampleData } = require('./src/data/sampleData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const childrenRouter = require('./src/routes/children');
const authorizationsRouter = require('./src/routes/authorizations');
const blacklistRouter = require('./src/routes/blacklist');
const checkinRouter = require('./src/routes/checkin');
const pickupRouter = require('./src/routes/pickup');
const exceptionsRouter = require('./src/routes/exceptions');
const reportsRouter = require('./src/routes/reports');

app.use('/api/children', childrenRouter);
app.use('/api/authorizations', authorizationsRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/pickup', pickupRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '托育接送授权API服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '托育园接送授权API系统',
    version: '1.0.0',
    description: '围绕托育机构孩子接送要核对授权人、临时授权、黑名单和接送时间展开',
    endpoints: {
      'POST /api/children': '创建儿童档案',
      'GET /api/children': '获取所有儿童列表',
      'GET /api/children/:id': '获取儿童详情',
      'GET /api/children/:id/status': '获取儿童当日状态(包含授权链路、历史记录)',
      'POST /api/authorizations/fixed': '创建固定授权',
      'GET /api/authorizations/fixed': '获取固定授权列表',
      'POST /api/authorizations/temporary': '创建临时授权',
      'POST /api/authorizations/temporary/:id/confirm': '确认临时授权',
      'POST /api/authorizations/temporary/:id/reject': '拒绝临时授权',
      'GET /api/authorizations/temporary': '获取临时授权列表',
      'POST /api/blacklist': '添加黑名单',
      'DELETE /api/blacklist/:id': '移除黑名单',
      'GET /api/blacklist': '获取黑名单列表',
      'POST /api/checkin': '入园签到(支持幂等)',
      'GET /api/checkin': '获取签到记录',
      'POST /api/pickup': '离园接送(支持幂等)',
      'GET /api/pickup': '获取接送记录',
      'GET /api/exceptions': '获取异常记录',
      'POST /api/exceptions/:id/resolve': '处理异常(需记录前后差异)',
      'GET /api/reports/daily': '获取每日接送报告',
      'GET /api/reports/export/daily': '导出每日接送报告'
    },
    features: [
      '授权过期拦截',
      '重复离园拦截',
      '临时授权未确认拦截',
      '黑名单拦截',
      '超时未接提醒检测',
      '重复执行/回调幂等保证',
      '人工修正留痕(前后差异+操作者)',
      '完整历史记录追踪',
      '异常记录与处理流程',
      '接送报告导出'
    ],
    builtinSamples: [
      '正常接送演示',
      '临时授权演示',
      '授权过期拦截演示',
      '重复离园拦截演示',
      '黑名单拦截演示',
      '临时授权未确认拦截演示'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

if (process.env.INIT_SAMPLE_DATA !== 'false') {
  initSampleData();
}

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  托育园接送授权API系统`);
  console.log(`  服务运行在 http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`\nAPI文档: GET http://localhost:${PORT}`);
  console.log(`健康检查: GET http://localhost:${PORT}/api/health`);
  console.log(`\n=== 快速测试命令 ===`);
  console.log(`curl http://localhost:${PORT}/api/children`);
  console.log(`curl http://localhost:${PORT}/api/reports/daily`);
  console.log(`\n`);
});
