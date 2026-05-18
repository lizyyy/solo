import express from 'express';
import { router } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api', router);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '售票核销服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`售票核销服务已启动，端口: ${PORT}`);
  console.log('API 文档:');
  console.log('  GET  /api/batches           - 票批次列表');
  console.log('  GET  /api/batches/:id       - 票批次详情');
  console.log('  GET  /api/batches/:id/history - 核销历史');
  console.log('  POST /api/verify            - 核销操作');
  console.log('  POST /api/import            - 批量导入');
  console.log('  GET  /api/export/batches    - 导出票批次');
  console.log('  GET  /api/export/records    - 导出核销记录');
  console.log('  GET  /api/verification-points - 核销点列表');
  console.log('  GET  /api/teams             - 团队列表');
  console.log('  GET  /api/records           - 核销记录列表');
});

export default app;
