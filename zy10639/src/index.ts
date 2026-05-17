import express from 'express';
import router from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use('/api', router);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '实验室LIMS样本重测申请API',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  实验室LIMS样本重测申请API');
  console.log('='.repeat(60));
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('  API 端点:');
  console.log('  POST   /api/retest              - 创建重测申请');
  console.log('  GET    /api/retest              - 查询申请列表');
  console.log('  GET    /api/retest/:id          - 查询申请详情');
  console.log('  PUT    /api/retest/:id          - 修改申请');
  console.log('  POST   /api/retest/:id/audit    - 审核申请');
  console.log('  POST   /api/retest/:id/withdraw - 撤回申请');
  console.log('  POST   /api/retest/:id/result   - 提交重测结果');
  console.log('  POST   /api/retest/:id/resubmit - 重新提交');
  console.log('  GET    /api/retest/:id/history  - 查询操作历史');
  console.log('  GET    /api/export              - 导出CSV');
  console.log('  POST   /api/import-bad-row      - 导入坏行');
  console.log('='.repeat(60));
  console.log('  提示: 本地运行不依赖外部服务');
  console.log('='.repeat(60));
});
