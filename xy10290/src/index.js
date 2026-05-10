const express = require('express');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '房车营地水电桩分摊API',
    version: '1.0.0',
    endpoints: {
      'GET /api/health': '健康检查',
      'GET /api/rules': '查看所有业务规则',
      'GET /api/rules/validate': '运行规则验证器（查看报告）',
      'POST /api/campsites': '创建营地',
      'POST /api/campsites/:id/spots': '创建车位',
      'POST /api/campsites/:id/pillars': '创建水电桩',
      'POST /api/pillars/:pillarId/connect/:spotId': '绑定桩到车位',
      'POST /api/stays/check-in': '车位入住（必须有X-Request-Id）',
      'POST /api/meter-readings': '记录水电读数（必须有X-Request-Id）',
      'POST /api/allocations': '执行费用分摊（必须有X-Request-Id）',
      'POST /api/stays/:id/check-out': '退营（必须有X-Request-Id）',
      'POST /api/settlements': '创建结算（必须有X-Request-Id）',
      'POST /api/settlements/:id/confirm': '确认结算（必须有X-Request-Id）',
      'GET /api/stays/:id': '查看入住详情',
      'GET /api/stays/:id/summary': '查看费用汇总',
      'GET /api/issues': '查看问题列表',
      'POST /api/issues/:id/resolve': '解决问题'
    },
    notes: [
      '所有写入接口必须提供 X-Request-Id 头保证幂等性',
      '所有金额以"分"为单位，避免浮点数精度问题',
      'GET /api/rules/validate 可以验证所有规则是否生效'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('未捕获错误:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 房车营地水电桩分摊API已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`\n📋 快速验证规则是否生效:`);
  console.log(`   curl http://localhost:${PORT}/api/rules/validate`);
  console.log(`\n📖 查看所有规则:`);
  console.log(`   curl http://localhost:${PORT}/api/rules`);
  console.log('\n');
});

module.exports = app;
