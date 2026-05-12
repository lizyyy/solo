const express = require('express');
const apiRoutes = require('./routes/api');
const { runDemo } = require('./tests/runTests');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTO_LOAD_DEMO = process.env.AUTO_LOAD_DEMO === 'true';

app.use(express.json());

app.use('/api/v1', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '家政阿姨排班 API',
    version: '1.0.0',
    description: '处理客户偏好、技能匹配、路程计算、请假和换人补偿的家政服务排班系统',
    demoLoaded: AUTO_LOAD_DEMO,
    endpoints: {
      'GET /api/v1/health': '健康检查',
      'POST /api/v1/nannies': '创建阿姨档案',
      'GET /api/v1/nannies': '获取所有阿姨',
      'POST /api/v1/skills': '创建技能标签',
      'GET /api/v1/skills': '获取所有技能',
      'POST /api/v1/orders': '创建客户订单',
      'GET /api/v1/orders': '获取所有订单',
      'POST /api/v1/schedules': '创建排班（分配阿姨）',
      'GET /api/v1/schedules/:id': '获取排班详情',
      'POST /api/v1/schedules/:id/advance': '推进排班状态',
      'POST /api/v1/schedules/:id/reassign': '重新分配阿姨',
      'POST /api/v1/schedules/:id/manual-correct': '人工修正',
      'GET /api/v1/schedules/daily/:date': '获取每日排班',
      'POST /api/v1/leaves': '创建请假',
      'POST /api/v1/leaves/:id/approve': '批准请假',
      'GET /api/v1/leaves': '获取所有请假',
      'GET /api/v1/compensations': '获取所有补偿',
      'GET /api/v1/orders/:id/reassign-history': '获取换人历史',
      'GET /api/v1/orders/:id/customer-impact': '获取客户影响',
      'GET /api/v1/reports/daily/:date': '导出每日报告',
      'GET /api/v1/audit-logs': '获取审计日志'
    }
  });
});

function startServer() {
  if (AUTO_LOAD_DEMO) {
    console.log('='.repeat(60));
    console.log('  自动加载演示数据...');
    console.log('='.repeat(60) + '\n');
    runDemo();
    console.log('\n' + '='.repeat(60));
    console.log('  演示数据加载完成，启动 API 服务...');
    console.log('='.repeat(60) + '\n');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║         家政阿姨排班 API - 启动成功                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  服务地址:   http://localhost:${PORT}${' '.repeat(39)}║`);
    console.log(`║  API 文档:   http://localhost:${PORT}/                        ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  启动方式:                                                  ║');
    console.log('║  - 普通模式:  npm start                                     ║');
    console.log('║  - 带演示数据: AUTO_LOAD_DEMO=true npm start                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
