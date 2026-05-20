import { createServer } from './api/server';

const PORT = process.env.PORT || 3000;

const app = createServer();

app.listen(PORT, () => {
  console.log(`公交失物招领对账服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('API 端点:');
  console.log('  POST /api/batches          - 创建对账批次（上传CSV文件）');
  console.log('  GET  /api/batches          - 获取所有批次列表');
  console.log('  GET  /api/batches/:id      - 获取批次详情');
  console.log('  GET  /api/batches/:id/matches - 获取匹配列表（支持筛选）');
  console.log('  GET  /api/batches/:id/matches/:matchId - 获取匹配详情');
  console.log('  POST /api/batches/:id/matches/:matchId/approve - 审批通过');
  console.log('  POST /api/batches/:id/matches/:matchId/reject - 审批驳回');
  console.log('  POST /api/batches/:id/matches/:matchId/manual-match - 人工匹配');
  console.log('  POST /api/batches/:id/matches/:matchId/unmatch - 解除匹配');
  console.log('  POST /api/batches/:id/recalculate - 重新计算匹配');
  console.log('  POST /api/batches/:id/complete - 完成对账批次');
  console.log('  GET  /api/batches/:id/report?format=json|csv|excel|text - 下载报告');
  console.log('  GET  /api/batches/:id/matches/:matchId/audit-report - 下载单条记录审计报告');
  console.log('  GET  /health               - 健康检查');
});
