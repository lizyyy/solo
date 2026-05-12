const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => {
  res.redirect('/api');
});

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  直播礼物分账 API - 服务已启动');
  console.log('========================================');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 根路径: http://localhost:${PORT}/api`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log('========================================');
  console.log('');
  console.log('  主要路由:');
  console.log('    GET  /api/health                   - 健康检查');
  console.log('    POST /api/anchors                  - 创建主播');
  console.log('    POST /api/guilds                   - 创建公会');
  console.log('    POST /api/rules                    - 创建分账规则');
  console.log('    POST /api/gifts                    - 提交礼物（幂等）');
  console.log('    POST /api/freezes                  - 创建冻结');
  console.log('    POST /api/refunds                  - 提交退款');
  console.log('    POST /api/settlements/create       - 创建结算单');
  console.log('    POST /api/settlements/:id/finalize - 完成结算');
  console.log('    POST /api/settlements/:id/correct  - 人工修正');
  console.log('    GET  /api/settlements/:id/history  - 查看历史');
  console.log('    GET  /api/reports/anchor-explanation/:id/text - 主播解释报告');
  console.log('    GET  /api/exceptions               - 查看异常');
  console.log('    POST /api/exceptions/:id/retry     - 重试异常');
  console.log('    GET  /api/dashboard                - 仪表盘');
  console.log('');
  console.log('  运行演示脚本:');
  console.log('    npm test                           - 运行所有样例场景');
  console.log('');
});
