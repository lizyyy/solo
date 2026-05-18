const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { initializeData } = require('./data/initData');

const volunteerRoutes = require('./routes/volunteers');
const serviceRecordRoutes = require('./routes/serviceRecords');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '社区志愿者服务时长管理API运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/volunteers', volunteerRoutes);
app.use('/api/service-records', serviceRecordRoutes);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用社区志愿者服务时长管理API',
    endpoints: {
      health: 'GET /api/health',
      volunteers: {
        list: 'GET /api/volunteers',
        create: 'POST /api/volunteers',
        getById: 'GET /api/volunteers/:id',
        update: 'PUT /api/volunteers/:id',
        getRecords: 'GET /api/volunteers/:id/records'
      },
      serviceRecords: {
        list: 'GET /api/service-records',
        create: 'POST /api/service-records',
        getById: 'GET /api/service-records/:id',
        update: 'PUT /api/service-records/:id',
        delete: 'DELETE /api/service-records/:id',
        import: 'POST /api/service-records/import',
        export: 'GET /api/service-records/export/data',
        statistics: 'GET /api/service-records/statistics/summary'
      }
    },
    features: [
      '本地JSON文件持久化存储',
      '代签与迟到补签冲突检测',
      '已公示记录保护（禁止静默覆盖）',
      '业务争议清晰反馈',
      '批量导入导出支持'
    ]
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

function checkEnvironment() {
  const issues = [];
  
  if (!process.version || parseInt(process.version.replace('v', '').split('.')[0]) < 12) {
    issues.push('Node.js版本建议12.0或更高');
  }
  
  return issues;
}

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  社区志愿者服务时长管理API');
  console.log('='.repeat(60));
  
  const envIssues = checkEnvironment();
  if (envIssues.length > 0) {
    console.log('\n⚠️  环境检查提醒:');
    envIssues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  console.log(`\n🚀 服务已启动: http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/api`);
  console.log(`💊 健康检查: http://localhost:${PORT}/api/health\n`);
  
  const testData = initializeData();
  
  console.log('\n' + '-'.repeat(60));
  console.log('  📋 测试数据说明:');
  console.log('-'.repeat(60));
  console.log('  ✅ 正常记录: 4条已公示/待公示的服务记录');
  console.log('  ⚠️  冲突记录: 代签+迟到补签同时出现的测试数据');
  console.log('  ❌ 导入坏行: 3条包含各种错误的导入测试数据');
  console.log('\n  🔍 测试命令示例:');
  console.log('     # 获取所有服务记录');
  console.log('     curl http://localhost:3000/api/service-records');
  console.log('');
  console.log('     # 测试代签+迟到补签冲突 (POST冲突记录)');
  console.log('     curl -X POST http://localhost:3000/api/service-records \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"volunteerId":"V001","volunteerName":"张秀英","serviceDate":"2024-05-15","serviceProject":"图书整理","serviceHours":2,"isLateMakeup":true,"isProxySign":true,"proxySigner":"儿子代签"}\'');
  console.log('');
  console.log('     # 测试已公示记录覆盖保护 (PUT已公示记录)');
  console.log('     curl -X PUT http://localhost:3000/api/service-records/R001 \\');
  console.log('       -H "Content-Type: application/json" \\');
  console.log('       -d \'{"serviceHours":8}\'');
  console.log('');
  console.log('     # 导出数据 (JSON/CSV)');
  console.log('     curl http://localhost:3000/api/service-records/export/data');
  console.log('     curl http://localhost:3000/api/service-records/export/data?format=csv');
  console.log('='.repeat(60) + '\n');
});

module.exports = app;