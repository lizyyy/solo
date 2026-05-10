const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('合同价税分离 API 服务已启动');
  console.log('='.repeat(60));
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档: http://localhost:${PORT}/`);
  console.log('='.repeat(60));
  console.log('');
  console.log('可用接口示例:');
  console.log('  1. 查询税率规则:  GET  /api/tax-rules/active');
  console.log('  2. 创建合同:      POST /api/contracts');
  console.log('  3. 查询合同报告:  GET  /api/contracts/:id/report');
  console.log('  4. 变更金额:      POST /api/contracts/:id/amount');
  console.log('  5. 变更税率:      POST /api/contracts/:id/tax-rate');
  console.log('  6. 提交审批:      POST /api/approvals');
  console.log('  7. 财务导出:      GET  /api/exports/contracts/:id/finance?format=text');
  console.log('  8. 版本历史:      GET  /api/exports/contracts/:id/history?format=text');
  console.log('');
  console.log('='.repeat(60));
});
